# Tính năng thông báo phía frontend HESTA

Thông báo nhận theo thời gian thực hiện thêm một toast tạm thời theo hệ thống
thiết kế HESTA sau khi lấy nội dung riêng tư thành công. Danh sách và trạng
thái đã đọc/chưa đọc vẫn được lưu trong bảng thông báo; các thao tác đánh dấu
đã đọc báo kết quả qua `react-hot-toast`.

Tài liệu này mô tả kiến trúc, hợp đồng dữ liệu, luồng xử lý và cách kiểm thử
tính năng thông báo ở HESTA Frontend.

## 1. Phạm vi

Notification Frontend hỗ trợ:

- tải thông báo đã lưu từ backend;
- hiển thị số lượng chưa đọc;
- hiển thị trạng thái đã đọc/chưa đọc;
- đánh dấu một thông báo là đã đọc;
- đánh dấu tất cả thông báo trong phạm vi hiện tại là đã đọc;
- nhận `NOTIFICATION_CREATED` qua hạ tầng realtime dùng chung;
- cô lập dữ liệu theo người dùng và ngôi nhà hiện tại;
- xóa dữ liệu thông báo khi đăng xuất hoặc đổi tài khoản.

Không thuộc phạm vi:

- Notification Preference vì backend chưa cung cấp controller/API;
- email, SMS, mobile push, Firebase hoặc APNs;
- một WebSocket/STOMP client riêng cho Notification;
- thay đổi backend hoặc database.

## 2. Cấu trúc source

```text
src/
├── components/notification/
│   └── NotificationBell.tsx
├── realtime/
│   ├── NotificationLifecycle.tsx
│   ├── RealtimeLifecycle.tsx
│   ├── realtimeClient.ts
│   └── realtimeEvents.ts
├── services/
│   └── notificationApi.ts
├── store/
│   ├── notificationSelectors.ts
│   ├── notificationSlice.ts
│   └── store.ts
└── types/
    └── notification.ts

tests/
└── notification.test.mjs
```

Vai trò chính:

| File | Trách nhiệm |
| --- | --- |
| `types/notification.ts` | Kiểu DTO, enum, pagination và realtime payload đúng theo backend |
| `services/notificationApi.ts` | Gọi REST API qua `apiClient` dùng chung |
| `store/notificationSlice.ts` | State, async operation, phân trang, unread count và chống trùng |
| `store/notificationSelectors.ts` | Selector có kiểu cho Notification state |
| `realtime/NotificationLifecycle.tsx` | Tải REST ban đầu và đăng ký handler với dispatcher dùng chung |
| `components/notification/NotificationBell.tsx` | Bell, badge và notification panel |
| `tests/notification.test.mjs` | Contract, Redux, realtime, isolation, logout và UI-state test |

## 3. Hợp đồng backend

Frontend sử dụng API base URL từ `VITE_API_BASE_URL`. Nếu biến này không được
cấu hình, `apiClient` dùng `/api/v1`.

### 3.1 Danh sách thông báo

```http
GET /api/v1/notifications
```

Query parameter được backend hỗ trợ:

| Tên | Kiểu | Bắt buộc | Ý nghĩa |
| --- | --- | --- | --- |
| `homeId` | UUID | Không | Chỉ lấy thông báo của một nhà |
| `isRead` | boolean | Không | Lọc theo trạng thái đọc |
| `type` | enum | Không | Lọc loại thông báo |
| `priority` | enum | Không | Lọc mức ưu tiên |
| `page` | number | Không | Trang, bắt đầu từ `0` |
| `size` | number | Không | Số phần tử; backend giới hạn tối đa `100` |

Response nằm trong `ApiResponse.result`:

```ts
interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}
```

### 3.2 Chi tiết thông báo

```http
GET /api/v1/notifications/{notificationId}
```

Endpoint này đặc biệt quan trọng cho realtime. Backend không broadcast nội
dung riêng tư của thông báo lên topic của cả nhà; frontend phải lấy DTO đầy đủ
qua endpoint này sau khi nhận sự kiện.

### 3.3 Đánh dấu một thông báo đã đọc

```http
PATCH /api/v1/notifications/{notificationId}/read
```

Frontend chỉ cập nhật Redux sau khi backend xác nhận và trả về DTO đã có
`isRead = true`.

### 3.4 Đánh dấu tất cả đã đọc

```http
PATCH /api/v1/notifications/read-all?homeId={homeId}
```

- Khi có `homeId`, chỉ cập nhật thông báo của nhà hiện tại.
- Khi không có `homeId`, backend cập nhật toàn bộ thông báo thuộc người dùng.
- Response chứa `updatedCount`.

## 4. Notification DTO

```ts
interface NotificationResponse {
  id: string;
  userId: string;
  homeId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: string;
}
```

Loại thông báo hợp lệ:

```text
SECURITY
AUTOMATION
ANOMALY
SYSTEM
DEVICE
```

Mức ưu tiên hợp lệ:

```text
HIGH
MEDIUM
LOW
```

Frontend dùng trường `priority` đúng theo backend, không tự đổi tên thành
`severity`.

## 5. Redux state

Notification reducer được đăng ký tại `state.notification`.

State chính gồm:

```ts
interface NotificationState {
  items: NotificationResponse[];
  unreadCount: number;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  isLoadingMore: boolean;
  error: string | null;
  mutationError: string | null;
  lastActionMessage: string | null;
  currentUserId: string | null;
  currentHomeId: string | null;
  initialized: boolean;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
  markingReadIds: string[];
  markingAll: boolean;
}
```

`unreadCount` được lấy chính xác từ `totalElements` của request
`isRead=false`, thay vì chỉ đếm các item của trang đang hiển thị.

Các async operation:

| Operation | Chức năng |
| --- | --- |
| `loadNotifications` | Tải trang thông báo và unread count |
| `receiveNotificationFromRealtime` | Kiểm tra payload rồi tải DTO riêng tư |
| `markNotificationAsRead` | Đánh dấu một item đã đọc |
| `markAllNotificationsAsRead` | Đánh dấu tất cả trong scope hiện tại |

## 6. Luồng tải ban đầu

`NotificationLifecycle` được mount một lần ở cấp ứng dụng.

```text
Auth state / currentHomeId thay đổi
                |
                v
notificationScopeChanged
                |
                v
GET /notifications?page=0&size=20
GET /notifications?isRead=false&page=0&size=1
                |
                v
Notification Redux state
                |
                v
NotificationBell / NotificationPanel
```

Hai request ban đầu được chạy song song:

1. request danh sách lấy dữ liệu trang đầu;
2. request `isRead=false` dùng `totalElements` để lấy unread count chính xác.

REST là nguồn dữ liệu bền vững. Realtime chỉ bổ sung các thay đổi xảy ra sau
khi kết nối.

## 7. Luồng realtime

Notification không tạo WebSocket hoặc STOMP client mới.

```text
Backend Notification created
            |
            v
/topic/homes/{homeId}/events
            |
            v
SharedRealtimeClient
            |
            v
RealtimeEventDispatcher
            |
            v
NotificationLifecycle
            |
            v
GET /notifications/{notificationId}
            |
            v
notification Redux state
```

Payload của `NOTIFICATION_CREATED`:

```ts
interface NotificationRealtimePayload {
  notificationId: string;
  recipientId: string;
  homeId: string;
  isRead: boolean;
  createdAt: string;
}
```

Trước khi gọi detail API, frontend xác nhận:

- event có type `NOTIFICATION_CREATED`;
- `event.homeId` trùng `payload.homeId`;
- `payload.recipientId` trùng người dùng hiện tại;
- `payload.homeId` trùng nhà hiện tại.

Sau khi tải detail, frontend tiếp tục xác nhận `id`, `userId` và `homeId` của
DTO khớp payload. Payload không chứa `title`, `message`, `type` hoặc `priority`
để tránh lộ nội dung riêng tư cho các thành viên khác trên home topic.

## 8. Chống sự kiện trùng

Cơ chế chống trùng có hai tầng:

1. `SharedRealtimeClient` giữ cache giới hạn các `eventId` gần đây;
2. Notification reducer chỉ insert khi chưa có notification cùng `id`.

Vì vậy:

- cùng một event không được xử lý hai lần;
- hai event khác nhau cùng trỏ đến một notification cũng không tạo hai item.

Khi initial REST và realtime chạy đồng thời, kết quả REST được merge theo ID
thay vì ghi đè toàn bộ, nên notification mới không bị mất do race condition.

## 9. Phạm vi nhà và người dùng

Mỗi state Notification gắn với:

```text
currentUserId + currentHomeId
```

Khi đổi nhà:

1. state cũ được thay bằng scope mới;
2. danh sách của nhà mới được tải từ REST;
3. response trễ của nhà cũ bị bỏ qua;
4. lỗi realtime của scope cũ không xuất hiện trong scope mới;
5. shared realtime client chuyển subscription sang topic nhà mới.

`DevicePage` đồng bộ `homeId` từ route vào Redux khi mount, vì vậy subscription
và Notification scope vẫn đúng khi người dùng rời trang tổng quan để xem thiết
bị.

Khi đăng xuất, action `sessionEnded` đưa Notification state về trạng thái ban
đầu. Dữ liệu của tài khoản trước không được giữ lại cho phiên sau.

## 10. UI và accessibility

`NotificationBell` được đặt tại:

- Home dashboard;
- Device page;
- Admin dashboard.

Panel cung cấp:

- badge số chưa đọc, hiển thị tối đa `99+`;
- trạng thái read/unread bằng dấu chấm và nhãn truy cập, không chỉ dùng màu;
- loại và mức ưu tiên;
- thời gian định dạng bằng `Intl.DateTimeFormat('vi-VN')`;
- loading skeleton;
- empty state;
- error state có nút thử lại;
- success/error feedback cho mutation;
- nút tải trang tiếp theo;
- đóng bằng click bên ngoài hoặc phím `Escape`;
- accessible name cho bell và từng notification.

UI dùng semantic token của HESTA như `bg-surface`, `border-line`, `text-text`,
`text-muted`, `bg-primary`, `bg-info-soft`, `bg-warning-soft` và
`bg-error-soft`.

## 11. Xử lý lỗi

- Lỗi initial load hiển thị error state và nút **Thử lại**.
- Nếu đã có dữ liệu, lỗi refresh/realtime hiển thị cảnh báo nhưng không xóa
  danh sách hiện tại.
- Lỗi mark-read/read-all không thay đổi read state giả tạo.
- `401` tiếp tục đi qua interceptor chung của `apiClient` và lifecycle hết
  phiên hiện có.
- Response không có `result` được xem là contract error.

## 12. Kiểm thử

Chạy toàn bộ kiểm thử frontend:

```bash
npm test
```

Chạy các quality gate:

```bash
npm run lint
npm run build
```

`tests/notification.test.mjs` bao phủ:

- endpoint, method, query parameter và Authorization contract;
- tải danh sách ban đầu và unread count;
- read/unread state;
- mark one và mark all;
- nhận `NOTIFICATION_CREATED`;
- chống duplicate notification;
- cô lập theo home/user;
- logout xóa state;
- validate realtime payload;
- loading, error, empty, read và unread UI states.

## 13. Checklist kiểm tra thủ công

1. Đăng nhập và vào `/home`.
2. Chọn một nhà, mở bell và xác nhận danh sách tải từ REST.
3. So sánh badge với số thông báo chưa đọc trên backend.
4. Chọn một notification chưa đọc và xác nhận badge giảm sau khi PATCH thành
   công.
5. Chọn **Đọc tất cả** và xác nhận dữ liệu vẫn là đã đọc sau khi refresh.
6. Tạo một notification ở backend cho user và home hiện tại.
7. Xác nhận notification xuất hiện mà không refresh trang.
8. Publish lại cùng `eventId` và xác nhận không có item trùng.
9. Publish event khác nhưng cùng `notificationId` và xác nhận vẫn chỉ có một
   item.
10. Đổi từ Home A sang Home B và xác nhận không nhìn thấy dữ liệu Home A.
11. Vào `/home/{homeId}/devices` và xác nhận realtime subscription vẫn giữ đúng
    nhà.
12. Đăng xuất rồi đăng nhập tài khoản khác và xác nhận state cũ đã được xóa.

## 14. Giới hạn contract hiện tại

- Backend chưa có Notification Preference API; frontend không cung cấp màn
  hình preference.
- Backend chỉ publish notification qua home topic. Khi không có nhà đang active,
  giao diện global/admin vẫn tải dữ liệu REST nhưng không nhận live event cho
  đến khi một home subscription được thiết lập.
- Backend realtime không có durable replay. Sau khi mất kết nối, REST vẫn là
  nguồn để khôi phục trạng thái persisted.
