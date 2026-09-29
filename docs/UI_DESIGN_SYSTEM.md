# Hệ thống thiết kế giao diện HESTA

Tài liệu này là nguồn quy chuẩn về hình thức hiển thị cho mọi giao diện HESTA được tạo mới hoặc chỉnh sửa. Hành vi sản phẩm và quy tắc API được mô tả trong `docs/FRONTEND_UI_FUNCTIONAL_SPEC.md`.

## Định hướng sản phẩm

HESTA là sản phẩm Nhà thông minh sáng sủa, hiện đại và thân thiện. Giao diện cần tạo cảm giác dễ chịu để các thành viên trong gia đình có thể hiểu nhanh.

- Dùng bề mặt màu trắng, xanh da trời nhạt và xanh bạc hà, cùng viền và bóng đổ nhẹ.
- Ưu tiên phân cấp rõ ràng, khoảng cách thoáng, điều khiển bo góc và nội dung tiếng Việt ngắn gọn.
- Không dùng bề mặt trang màu tối hoặc xanh navy, nền đen, điểm nhấn màu tím, phong cách neon hay biến thể giao diện tối.
- Tránh hiệu ứng trang trí lấn át trạng thái thiết bị hoặc thao tác chính.

## Token theo ngữ nghĩa

Mọi giá trị màu nằm trong `src/index.css`, thuộc `@theme`. Dùng các utility Tailwind theo ngữ nghĩa được tạo từ các token này; không đặt mã màu thập lục phân, RGB/HSL hoặc giá trị màu tùy ý trong component React.

| Mục đích | Ví dụ utility token | Giá trị |
| --- | --- | --- |
| Nền ứng dụng | `bg-app` | `#F8FCFF` |
| Bề mặt thẻ và hộp thoại | `bg-surface` | `#FFFFFF` |
| Thanh bên | `bg-sidebar` | `#EEF7FB` |
| Thanh bên khi rê chuột | `bg-sidebar-hover` | `#DFF1F8` |
| Mục đang chọn trên thanh bên | `bg-sidebar-active` | `#CDEFFA` |
| Đường viền | `border-line` | `#DCEAF2` |
| Thao tác chính | `bg-primary`, `text-primary` | `#5BC0EB` |
| Thao tác chính khi rê chuột | `hover:bg-primary-hover` | `#3DAFD9` |
| Điểm nhấn xanh bạc hà | `bg-mint`, `text-mint` | `#7BDCB5` |
| Xanh bạc hà khi rê chuột | `hover:bg-mint-hover` | `#5ECFA2` |
| Chữ chính | `text-text` | `#3A4A5A` |
| Chữ phụ | `text-muted` | `#6B7C8F` |
| Biểu tượng mặc định | `text-icon` | `#7A93A6` |

Màu trạng thái phải đi cùng màu nền nhạt tương ứng:

| Trạng thái | Màu chữ/biểu tượng | Màu nền |
| --- | --- | --- |
| Thành công / trực tuyến | `success` | `success-soft` |
| Vô hiệu hóa / ngoại tuyến | `off` | `off-soft` |
| Cảnh báo | `warning` | `warning-soft` |
| Lỗi | `error` | `error-soft` |
| Thông tin | `info` | `info-soft` |

Các utility slate/cyan/blue cũ chỉ được ánh xạ sang bảng màu sáng để tương thích với component hiện có. Không dùng chúng trong giao diện mới. Phần việc mới phải dùng token theo ngữ nghĩa.

## Nền tảng dùng chung

Tái sử dụng các thành phần sau trước khi thêm kiểu bố cục hoặc bề mặt mới:

- `AppSidebar` cho điều hướng trên máy tính khi đã đăng nhập.
- `AuthShell` cho trang xác thực và lời mời.
- `.app-shell` cho phần gốc của trang.
- `.app-sidebar` cho bề mặt điều hướng.
- `.surface-card` cho thẻ và bảng nội dung.
- `.auth-surface` cho biểu mẫu xác thực và biểu mẫu dạng hộp thoại.
- `.soft-grid`, `.gentle-rise` và `.custom-scrollbar` chỉ khi phù hợp với mục đích hiện có của chúng.

Khi một mẫu giao diện xuất hiện trong ít nhất hai tính năng, hãy tách thành component có kiểu dữ liệu rõ ràng trong `src/components/ui`. Component dùng chung nên cung cấp các biến thể có tên như `primary`, `secondary`, `danger` hoặc `success`; nơi sử dụng không được thay toàn bộ hệ thống hiển thị bằng chuỗi class tùy ý.

## Quy tắc cho component

- Nền trang: `bg-app`; bề mặt nội dung: `surface-card` hoặc `bg-surface`.
- Thẻ: `rounded-2xl`/`.surface-card`, `border-line` và bóng đổ nhẹ.
- Ô nhập liệu: bề mặt trắng hoặc xanh nhạt, `border-line`, chữ `text-text` dễ đọc và vòng viền focus dùng màu chính. Mỗi ô nhập liệu cần nhãn hiển thị gắn với nó.
- Nút chính: `bg-primary hover:bg-primary-hover text-white`.
- Nút phụ: bề mặt xanh nhạt với `text-text` hoặc `text-muted`.
- Thao tác xóa hoặc gây mất dữ liệu: chữ màu lỗi trên nền lỗi nhạt; yêu cầu xác nhận khi thao tác không thể hoàn tác.
- Biểu tượng: mặc định dùng `text-icon`, khi hoạt động dùng `text-primary`. SVG chỉ để trang trí phải được ẩn khỏi công nghệ hỗ trợ.
- Dùng một hệ phân cấp bo góc: thẻ 20–24 px, điều khiển 12–16 px; dạng viên chỉ dành cho trạng thái, bộ lọc, ảnh đại diện và thao tác nhỏ gọn.
- Chỉ tạo hiệu ứng động cho độ mờ hoặc phép biến đổi. Tuân thủ quy tắc giảm chuyển động toàn cục và không dùng `transition-all`.

## Các trạng thái bắt buộc và hành vi đáp ứng

Thông báo tạm thời về thành công, lỗi và nhắc thao tác dùng `notify` trong
`src/components/ui/notify.tsx`. Thành phần `AppToaster` được gắn một lần ở cấp
ứng dụng, dùng bề mặt sáng và màu trạng thái của hệ thống thiết kế. Giữ lỗi
kiểm tra dữ liệu cạnh trường nhập và giữ trạng thái lỗi cần thao tác khôi phục
trong trang. Hộp xác nhận trước thao tác không thể hoàn tác vẫn cần lựa chọn
rõ ràng của người dùng.

Mọi tính năng tải hoặc thay đổi dữ liệu phải chủ động xử lý:

- trạng thái đang tải hoặc khung chờ;
- trạng thái rỗng kèm hành động tiếp theo hữu ích;
- trạng thái lỗi API với `role="alert"` khi phù hợp;
- phản hồi thành công cho thay đổi có ý nghĩa;
- trạng thái vô hiệu hóa và đang gửi;
- bước xác nhận cho thao tác xóa hoặc gây mất dữ liệu.

Bắt đầu kiểm tra ở chiều rộng khung nhìn 320 px. Tránh chiều rộng nội dung cố định gây tràn; khi phù hợp, giữ vùng chạm ít nhất 44 px. Thanh bên trên máy tính không được làm nội dung trên điện thoại khó truy cập. Hộp thoại cần vai trò dialog có nhãn, hỗ trợ bàn phím, thao tác đóng rõ ràng và kiểm soát cuộn.

## Danh sách kiểm tra khi thay đổi giao diện

Trước khi bàn giao phần giao diện:

1. Xác nhận tính năng vẫn tuân theo `FRONTEND_UI_FUNCTIONAL_SPEC.md` và không thay đổi route, dữ liệu gửi tới API, quy tắc phiên, vai trò hoặc hành vi thời gian thực.
2. Xác nhận giao diện mới dùng token theo ngữ nghĩa và các thành phần dùng chung, không có màu thô hoặc màu bị cấm.
3. Kiểm tra truy cập bằng bàn phím, nhãn, focus, ngữ nghĩa hộp thoại, tràn nội dung khi đổi kích thước và các trạng thái đang tải/rỗng/lỗi/thành công/vô hiệu hóa.
4. Chạy `npm run lint`, `npm run build` và `npm test`.
