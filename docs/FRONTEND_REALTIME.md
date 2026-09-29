# Hạ tầng thời gian thực dùng chung ở frontend

HESTA chỉ có một kết nối thời gian thực ở frontend. Các trang tính năng, kể cả Digital Twin, không được tạo thêm kết nối `WebSocket` hoặc client STOMP riêng.

```text
Sự kiện từ backend
    |
    v
client thời gian thực dùng chung
    |
    v
bộ phân phối sự kiện trung tâm
    |
    v
action Redux / bộ xử lý của tính năng
```

## Kết nối và xác thực

`RealtimeLifecycle` được gắn một lần bên cạnh router. Thành phần này đọc access token hiện có từ trạng thái xác thực Redux và điều phối `realtimeClient` dùng chung. Client kết nối tới `/ws` dựa trên `VITE_API_BASE_URL` và chỉ gửi token trong header STOMP `CONNECT`:

```text
Authorization: Bearer <access-token>
```

Token không được thêm vào URL WebSocket hoặc ghi vào log. Khi token thay đổi, kết nối được thay thế; khi đăng xuất, kết nối bị ngắt và trạng thái thời gian thực trong Redux được xóa.

## Đăng ký kênh nhà và kết nối lại

ID của nhà đang chọn được chia sẻ qua home slice. Lifecycle yêu cầu client dùng chung đăng ký `/topic/homes/{homeId}/events`. Khi chọn nhà khác, client hủy đăng ký STOMP cũ trước rồi mới đăng ký kênh mới. Các yêu cầu đăng ký trùng lặp bị bỏ qua.

STOMP kết nối lại với thời gian chờ tăng dần theo hàm mũ, từ 1 đến 10 giây. Heartbeat gửi và nhận đều là 20 giây, khớp với giá trị mặc định của backend. Sau khi kết nối truyền tải được khôi phục, client dùng chung xác thực lại và tự động đăng ký lại kênh của nhà đang chọn. Khi kết nối thời gian thực không khả dụng, các thao tác REST vẫn hoạt động.

## Xử lý sự kiện trong một tính năng

Redux slice `realtime` chỉ lưu trạng thái hạ tầng: trạng thái kết nối, nhà đang đăng ký, thời điểm sự kiện cuối và thông báo lỗi an toàn. Mỗi sự kiện được chấp nhận cũng xuất hiện dưới dạng action `realtime/realtimeEventReceived` trong Redux DevTools. Dữ liệu nghiệp vụ không thuộc slice này.

Một tính năng đăng ký bộ xử lý một lần trong vòng đời của tính năng và phát action Redux có kiểu dữ liệu rõ ràng:

```ts
const unregister = realtimeEventDispatcher.register<DevicePayload>(
  'DEVICE_STATE_CHANGED',
  (event) => store.dispatch(deviceStateChanged(event.data)),
);
```

Gọi `unregister` khi dọn dẹp tính năng. Sự kiện cảm biến, thiết bị và thông báo đều dùng cùng bộ phân phối này. Lớp truyền tải phân tích hợp đồng `RealtimeEvent<T>` dùng chung và giữ một bộ nhớ đệm có giới hạn gồm các `eventId` gần đây để bỏ qua sự kiện trùng đơn giản.

`NotificationLifecycle` là bộ xử lý thông báo đã được triển khai. Sự kiện `NOTIFICATION_CREATED` chỉ chứa siêu dữ liệu an toàn (`notificationId`, `recipientId`, `homeId`, `isRead`, `createdAt`), nên lifecycle xác minh người dùng và nhà hiện tại rồi lấy nội dung thông báo riêng tư qua `GET /notifications/{notificationId}`. Sau đó notification slice chèn theo ID thông báo, giúp thao tác vẫn cho cùng kết quả khi các sự kiện khác nhau tham chiếu cùng một thông báo.

Chi tiết đầy đủ về thông báo ở frontend nằm tại [`FRONTEND_NOTIFICATION.md`](./FRONTEND_NOTIFICATION.md).

Để thêm sự kiện được backend hỗ trợ, thêm chính xác giá trị chuỗi của sự kiện vào `REALTIME_EVENT_TYPES`, rồi đăng ký bộ xử lý cho tính năng. Không tạo socket mới. Backend không bảo đảm phát lại sự kiện lâu dài hoặc thứ tự toàn cục, nên khi cần khôi phục, bộ xử lý phải tải lại dữ liệu chính thức qua REST.

## Cấu hình cục bộ và kiểm tra thủ công

Môi trường phát triển giữ cấu hình backend cục bộ hiện có trong `.env.development`. Với môi trường khác, đặt `VITE_API_BASE_URL` thành URL gốc của REST API. Client chuyển giao thức của origin đã cấu hình từ `http`/`https` sang `ws`/`wss` rồi thêm `/ws`.

1. Khởi chạy backend và frontend hiện có, sau đó đăng nhập như bình thường.
2. Mở Redux DevTools và chọn một nhà tại `/home`.
3. Xác nhận `realtime.status` chuyển thành `connected` và `activeHomeId` là nhà đã chọn.
4. Phát một sự kiện thử nghiệm từ backend cho nhà đó.
5. Xác nhận action `realtime/realtimeEventReceived` chứa `RealtimeEvent` tương ứng.
6. Chuyển sang nhà khác và kiểm tra `activeHomeId` thay đổi; đăng xuất và kiểm tra trạng thái trở về `disconnected`, không còn nhà đang hoạt động.
