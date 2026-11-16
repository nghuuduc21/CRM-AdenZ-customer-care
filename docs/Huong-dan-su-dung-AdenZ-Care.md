# Hướng dẫn sử dụng AdenZ Care (bản demo)

Tài liệu này giải thích **hệ thống làm gì, hoạt động ra sao, từng trang dùng để làm gì**, kèm các bài thử tay để bạn tự kiểm tra. Đọc theo thứ tự từ trên xuống, mỗi phần chỉ vài phút.

---

## 1. Hệ thống làm gì (đọc phần này trước)

**Một câu:** AdenZ Care đọc dữ liệu khách hàng từ Tourwell, **tự hiểu từng khách đang ở đâu trong hành trình** (mới mua, sắp đi, vừa về, lâu không quay lại, đang được tư vấn…), **tự gửi đúng email vào đúng lúc**, rồi **đo xem việc chăm sóc có hiệu quả không**: khách có mở, bấm, chấm điểm, thanh toán, đặt đơn mới không.

**Nhân viên vẫn làm việc trên Tourwell** như bình thường, không phải vào AdenZ Care. Khi có khách cần người xử lý (lead mới, khách phàn nàn, đơn sắp đi còn nợ…), nhân viên phụ trách nhận **email kèm link mở thẳng trên Tourwell**. Khi Tourwell có ghi nhận (lead đổi trạng thái, đã thu tiền, có ghi chú chăm sóc mới), AdenZ Care tự biết là đã xử lý.

```
   TOURWELL                    ADENZ CARE                                   KẾT QUẢ
 (dữ liệu công ty)
 khách, đơn hàng,   ──►  1. Đọc dữ liệu (chỉ đọc, mỗi đêm)
 phiếu thu, lead,        2. Chấm điểm, xếp nhóm, dự đoán từng khách   ──►  Email đến khách
 hành khách, tour        3. Quyết định hôm nay gửi gì cho ai          ──►  Email cảnh báo cho nhân viên (xử lý trên Tourwell)
                         4. Đo khách mở / bấm / chấm điểm / mua       ──►  Theo dõi chăm sóc, báo cáo cho sếp
```

Hệ thống có **hai cách gửi email**:

| | **Chăm sóc tự động** | **Chiến dịch** |
|---|---|---|
| Ai quyết định gửi | Hệ thống, theo quy tắc cài sẵn | Marketing hoặc Sếp |
| Khi nào | Mỗi sáng 9h, tự chạy | Khi bấm gửi, hoặc theo giờ hẹn |
| Ví dụ | Khách vừa thanh toán → email xác nhận. Khách sắp đi mà chưa có visa → email nhắc | "Gửi tour Nhật mùa hoa cho khách VIP và khách quen" |
| Cần duyệt | Không (đã cài sẵn) | **Có**, chưa duyệt thì không gửi được |

---

## 2. Các khái niệm cần biết

### 2.1 Khách đã mua và khách tiềm năng

- **Khách đã mua**: có ít nhất 1 đơn hàng trên Tourwell.
- **Khách tiềm năng**: chưa mua nhưng **đã tương tác** (có yêu cầu tư vấn / lead, hoặc được sale chăm sóc).

### 2.2 Nhóm khách đã mua (chấm theo 3 câu hỏi)

Hệ thống hỏi 3 câu về mỗi khách đã mua:

| Câu hỏi | Ký hiệu | Điểm 1–5 |
|---|---|---|
| Lần đặt tour gần nhất cách đây bao lâu? | **R** | ≤ 3 tháng: 5 · ≤ 6 tháng: 4 · ≤ 1 năm: 3 · ≤ 2 năm: 2 · lâu hơn: 1 |
| Đã mua bao nhiêu lần? | **F** | 1 lần: 1 · 2 lần: 3 · 3 lần: 4 · từ 4 lần: 5 |
| Tổng chi bao nhiêu (so với các khách khác)? | **M** | 20% khách chi nhiều nhất: 5 … 20% chi ít nhất: 1 |

Từ 3 điểm này, khách được xếp vào **6 nhóm**:

| Nhóm | Hiểu đơn giản | Nên làm gì |
|---|---|---|
| **VIP** | Chi nhiều nhất, mua nhiều lần hoặc vừa mua | Ưu đãi riêng, mời tour cao cấp sớm, gọi điện chăm sóc |
| **Trung thành** | Mua từ 2 lần, vẫn còn gắn bó | Gửi tour mới đúng sở thích |
| **Khách mới** | Mua lần đầu, gần đây | Cảm ơn, gợi ý chuyến thứ hai |
| **Cần giữ chân** | Từng mua nhiều lần nhưng lâu chưa quay lại | Ưu đãi quay lại, hỏi thăm |
| **Mua một lần** | Mới mua một lần, đã lâu | Gửi tour theo mùa |
| **Ngủ đông** | Hơn 2 năm chưa mua | Chiến dịch đánh thức, gửi thưa |

### 2.3 Điểm tiềm năng (khách chưa mua): 0–100

Cộng / trừ theo các dấu hiệu:

| Dấu hiệu | Điểm |
|---|---|
| Lead đang được tư vấn | +20 |
| Lead mới chưa ai tiếp nhận | +10 |
| Lead đã hủy | −30 |
| Đã có báo giá / báo giá đã tính xong | +15 / thêm +10 |
| Tương tác trong 14 ngày / 30 ngày | +20 / +10 |
| Khách cũ giới thiệu / đến từ quảng cáo | +15 / +5 |
| Có cả SĐT và email | +10 |
| Mở email / bấm xem tour trong 30 ngày | +5 / +15 |
| Không tương tác quá 90 ngày | −20 |

- **Nóng (≥ 70)**: sắp chốt, sale nên gọi trong 24 giờ.
- **Ấm (40–69)**: cần nuôi dưỡng.
- **Nguội (< 40)**: gửi thưa.

Các con số này **chỉnh được** ở Cài đặt → Trọng số điểm tiềm năng.

> Mọi điểm đều có **lý do** hiện trong hồ sơ khách, ví dụ "+20 đang được tư vấn, +15 đã có báo giá". Không có điểm "bí ẩn".

### 2.4 Dự đoán

| Dự đoán | Hệ thống đoán thế nào |
|---|---|
| **Điểm đến gợi ý tiếp theo** | Học từ chính dữ liệu công ty: khách đi Nhật thường đi tiếp đâu. Nếu khách đang hỏi một điểm đến thì ưu tiên điểm đó |
| **Tháng hay đi** | Tháng khởi hành thường gặp của khách (ví dụ hay đi Tết) |
| **Nguy cơ rời bỏ** | So với khoảng cách mua thường lệ của **chính khách đó** (ví dụ thường 6 tháng mua một lần mà đã 1 năm chưa mua → nguy cơ cao) |
| **Khả năng mua trong 90 ngày** | Cao / Trung bình / Thấp, kết hợp các yếu tố trên |

### 2.5 Tin giao dịch và tin quảng cáo

| | **Tin giao dịch** | **Tin chăm sóc / quảng cáo** |
|---|---|---|
| Ví dụ | Xác nhận đã nhận tiền, nhắc thanh toán, nhắc chuẩn bị, nhắc giấy tờ | Tour mới, ưu đãi, đánh thức, sinh nhật |
| Có link "Hủy nhận tin" | Không | **Có** (bắt buộc) |
| Khách đã hủy nhận tin vẫn nhận? | **Có** (vì liên quan chuyến đi của khách) | **Không** |
| Giới hạn số tin / tuần | Không | Tối đa 2 tin / khách / 7 ngày (chỉnh được) |
| Khung giờ | Gửi bất cứ lúc nào | Không gửi từ 20h đến 8h (chỉnh được) |

### 2.6 Hàng đợi gửi

Email không gửi một lúc mà **xếp hàng**, mỗi phút gửi một ít (mặc định 20 email/phút) vì hộp thư công ty bị giới hạn số email mỗi giờ. Tin quảng cáo đến khung giờ khuya sẽ chờ đến 8h sáng.

---

## 3. Chạy hệ thống lần đầu

1. Mở PowerShell (hoặc Terminal trong VS Code):
   ```powershell
   cd "E:\Management Web\Adenz_MIS_Platform\fb-graph-demo\fb-demo"
   npm run care
   ```
2. Màn hình hiện `AdenZ Care: http://localhost:3030`. Mở địa chỉ này bằng trình duyệt.
3. Lần đầu: điền họ tên, tên đăng nhập, mật khẩu (từ 8 ký tự) → **Tạo tài khoản**. Đây là tài khoản **Quản trị**.
4. **Giữ cửa sổ PowerShell mở** trong suốt lúc dùng. Tắt cửa sổ là hệ thống dừng.

**Dữ liệu mẫu:** lần đầu hệ thống tự tạo 74 khách hư cấu, ~105 đơn, 20 tour, ~210 hành khách. Email khách dạng `khach1@example.com` (không thuộc về ai). Dải vàng **"Đang dùng DỮ LIỆU MẪU"** ở đầu trang nhắc điều này.

**Làm lại từ đầu** (xóa mọi thứ đã thử): tắt chương trình (Ctrl + C), xóa thư mục `data\care`, chạy lại `npm run care`.

---

## 4. Một ngày hệ thống hoạt động thế nào

| Giờ | Hệ thống tự làm |
|---|---|
| **2:00** | Đọc dữ liệu mới từ Tourwell → chấm điểm lại, xếp nhóm lại cho mọi khách (khách đổi nhóm được ghi lại) |
| **Mỗi 5 phút** | Đọc lead mới, lead đổi trạng thái trên Tourwell. Lead mới → email cho nhân viên phụ trách. Quá 2 giờ chưa tiếp nhận → email cho sếp |
| **8:30** | Mỗi nhân viên nhận email danh sách khách cần chăm sóc hôm nay (kèm link Tourwell) |
| **9:00** | Chạy **Chăm sóc tự động**: xem hôm nay ai cần email gì → đưa vào hàng đợi; cập nhật danh sách khách cần nhân viên xử lý |
| **Mỗi phút** | Gửi email trong hàng đợi; gửi các chiến dịch đã duyệt đến giờ hẹn |
| **Bất cứ lúc nào** | Marketing / Sếp tạo, duyệt, gửi chiến dịch. Khách bấm link trong email → ghi nhận đã bấm. Khách bấm "Hủy nhận tin" → ngừng gửi quảng cáo |

Trong bản demo bạn không cần chờ đến giờ: các trang đều có nút **Xem trước** và **Chạy ngay**.

---

## 5. Từng trang trong hệ thống

### 5.1 Tổng quan

**Dùng để:** Sếp nhìn một lần biết tình hình khách hàng.

| Phần | Đọc thế nào |
|---|---|
| 8 ô số liệu | Khách đã mua, đã tương tác, khả năng mua cao, tiềm năng nóng, nguy cơ rời bỏ, đã từ chối nhận tin, **vấn đề giấy tờ chuyến sắp đi** (ô đỏ = cần xử lý), việc cần làm |
| Biểu đồ nhóm | Có bao nhiêu khách mỗi nhóm |
| "Tiềm năng nóng: nên liên hệ ngay" | Khách chưa mua nhưng sắp chốt, kèm điểm và điểm đến quan tâm |
| "Khách cũ có khả năng mua cao" | Khách đã mua, đang đến mùa hay đi, kèm điểm đến gợi ý |
| "Khách quen có nguy cơ rời bỏ" | Khách mua nhiều lần nhưng lâu không quay lại |
| "Chiến dịch gần đây" | Gửi bao nhiêu, mở, bấm, **mua lại** bao nhiêu |

**Thao tác:** bấm tên khách bất kỳ để mở hồ sơ.

### 5.2 Theo dõi chăm sóc

**Dùng để:** Sếp, Marketing xem AdenZ Care đã chăm sóc khách thế nào và có hiệu quả không. Nhân viên **không cần** vào trang này.

| Phần | Đọc thế nào |
|---|---|
| **8 ô số liệu** | Email đã gửi, khách mở, khách bấm, điểm hài lòng, **khách đặt đơn sau khi nhận tin**, **đơn được nhắc đã trả đủ**, **thời gian tiếp nhận lead** (đo theo lúc Tourwell đổi trạng thái), **cảnh báo được xử lý trên Tourwell** |
| **Khách cần nhân viên xử lý** | Danh sách cảnh báo theo mức Gấp / Hôm nay / Khi rảnh: ai phụ trách, hạn, gợi ý cách nói, nút **Mở trên Tourwell**. Người phụ trách đã nhận email |
| **Đã xử lý / hết hạn** | Cảnh báo tự đóng khi Tourwell có ghi nhận; quá 14 ngày không thấy xử lý thì tính "hết hạn" (dùng để đánh giá ai chưa làm) |
| **Khách tương tác** | Dòng thời gian: khách mở email, bấm xem tour, chấm điểm khảo sát, hủy nhận tin, đặt đơn hoặc hỏi tư vấn trên Tourwell sau khi nhận tin |
| **Hiệu quả từng loại tin** | Mỗi loại tin tự động, mỗi chiến dịch: gửi, mở, bấm, và **kết quả mong đợi** có đạt không (nhắc thanh toán → khách trả đủ; khảo sát → khách trả lời; tin gợi ý → khách đặt đơn / hỏi tư vấn trong 30 ngày) |

**Các loại cảnh báo** (theo Quy trình chăm sóc v1):

| Loại | Khi nào | Tự đóng khi |
|---|---|---|
| Lead mới / Lead KMV | Lead "Chưa tiếp nhận" trên Tourwell (hạn 15 phút trong giờ hành chính) | Lead đổi trạng thái trên Tourwell |
| Theo đuổi lead | Lead đang xử lý đến ngày 1, 3, 7 | Lead có đơn, bị hủy, hoặc có ghi nhận chăm sóc mới |
| Giấy tờ | Đơn sắp đi thiếu hộ chiếu đủ hạn, visa | Có ghi nhận chăm sóc mới |
| Bán kèm | Đơn mới 3 ngày: gợi ý dịch vụ còn thiếu | Có ghi nhận chăm sóc mới |
| Chưa thanh toán đủ | Còn 3 ngày đến ngày đi mà còn nợ (email cả kế toán) | Khách trả đủ |
| Gọi khách hạng cao, khảo sát 7–8, phàn nàn (0–6), gợi ý chuyến tiếp theo, cảm ơn người giới thiệu, visa được cấp / bị từ chối | Theo quy trình | Có ghi nhận chăm sóc mới trên Tourwell |
| Nhắc việc từ Tourwell | Lời nhắc nhân viên đặt trong lịch sử chăm sóc trên Tourwell đến hạn | Lời nhắc được đánh dấu xong trên Tourwell |

**Lead đã hủy** trên Tourwell tự chuyển sang **nuôi dưỡng 6 tháng** (nhận tin đúng nhu cầu đã hỏi); lead thử nghiệm ("test", "1234"…) thì không nhận tin. Không ai phải nhập lý do.

### 5.2b Báo cáo

**Dùng để:** sếp xem việc chăm sóc có hiệu quả không. 15 chỉ số so với mục tiêu, chia 3 nhóm: **khách nhận và tương tác** (gửi, mở, bấm, hủy nhận, trả lời khảo sát, điểm hài lòng), **kết quả trên Tourwell** (khách đặt đơn sau khi nhận tin, đơn được nhắc đã trả đủ, thời gian tiếp nhận lead, lead chưa tiếp nhận, lead KMV thành đơn, cảnh báo được xử lý, lời nhắc quá hạn), **kinh doanh** (đơn nhiều dịch vụ, khách mua lại); kèm số cảnh báo đang mở, quá hạn của từng nhân viên. Chọn kỳ 7 / 30 / 90 ngày. Sếp nhận bản này qua email lúc 09:00 thứ Hai; bấm **Gửi báo cáo qua email ngay** để nhận thử.

### 5.3 Khách hàng

Cột **Dịch vụ đã dùng** (vé máy bay, tour, land tour, visa, khách sạn, bảo hiểm, thuê xe…) và **Hạng** (Tiêu chuẩn, Bạc, Vàng, Kim cương, do Tourwell tự tính). Lọc được theo dịch vụ và hạng, ví dụ "khách từng mua vé máy bay, hạng Vàng".


**Dùng để:** tra cứu khách.

- Ô tìm: tên, mã khách, email, SĐT.
- Lọc theo **nhóm**, **khả năng mua**, **điểm đến** (đã đi hoặc được gợi ý).
- Cột "Điểm": khách đã mua hiện `R5 F4 M5`, khách tiềm năng hiện `80/100`.

**Bấm một dòng → hồ sơ 360° (bên phải):**

| Phần | Nội dung |
|---|---|
| Thông tin | Mã, email, SĐT, sale phụ trách, nguồn, ngày sinh |
| Nhận email quảng cáo | **Đồng ý** hoặc **Đã từ chối**. Nút **Chặn gửi** khi khách gọi điện yêu cầu ngừng nhận tin |
| Điểm và lý do | Vì sao khách có điểm / nhóm này |
| Dự đoán | Khả năng mua, điểm đến gợi ý, đã đi đâu, tháng hay đi, nguy cơ rời bỏ, tổng chi |
| Chiến lược nhóm | Hành động và ưu đãi áp dụng cho nhóm của khách |
| Đơn hàng, yêu cầu tư vấn | Lịch sử mua, các lần hỏi tour |
| Tin đã gửi | Mọi email đã gửi khách: đã mở chưa, đã bấm chưa |
| Thay đổi nhóm | Ví dụ "Khách mới → Trung thành" |

### 5.4 Nhóm khách & ưu đãi theo nhóm (mở từ Cài đặt → Thiết lập khác)

Hệ thống tự xếp khách vào nhóm (VIP, Thân thiết, Khách mới, Cần giữ chân…). Ô **Ưu đãi** được chèn vào email ở chỗ `{{uu_dai}}` cho khách **chưa có quyền lợi theo hạng thành viên** (quyền lợi theo hạng nhập ở Cài đặt → Quy trình chăm sóc được ưu tiên). Ô "Hành động" chỉ là ghi chú; ô "Tối đa tin mỗi tháng" hiện chưa được áp dụng (hệ thống dùng giới hạn chung 2 tin quảng cáo/tuần).


**Dùng để:** Sếp / Marketing quyết định mỗi nhóm khách được chăm sóc thế nào.

Mỗi nhóm có 3 ô:

- **Hành động chăm sóc**: mô tả cho nhân viên đọc.
- **Ưu đãi**: câu ưu đãi được **tự chèn vào email** ở chỗ có biến `{{uu_dai}}`. Ví dụ VIP: "Ưu đãi riêng 5% hoặc nâng hạng phòng". Để trống thì email không có dòng ưu đãi.
- **Tối đa tin mỗi tháng**: con số tham khảo cho chiến lược của nhóm.

Bấm **Lưu** ở từng nhóm.

### 5.5 Chiến dịch

**Dùng để:** Marketing / Sếp gửi email cho một nhóm khách.

**Tạo chiến dịch (4 bước trên một trang):**

1. **Gửi cho ai** – tích chọn, có thể kết hợp:
   - Nhóm khách (VIP, Trung thành…)
   - Đã từng đi (ví dụ Hàn Quốc)
   - Dự đoán điểm đến tiếp theo là (ví dụ Nhật Bản)
   - Khả năng mua (Cao…)

   Ô xanh bên dưới cho biết **bao nhiêu khách sẽ nhận** và **bao nhiêu bị loại vì sao** (chưa có email, đã từ chối, đã nhận đủ 2 tin tuần này).
2. **Nội dung email** – tiêu đề và nội dung. Bấm các biến để chèn:

   | Biến | Được thay bằng |
   |---|---|
   | `{{ten}}` | Tên khách |
   | `{{sale}}` | Sale phụ trách |
   | `{{diem_den_goi_y}}` | Điểm đến dự đoán cho khách |
   | `{{diem_den_da_di}}` | Các nơi khách đã đi |
   | `{{uu_dai}}` | Ưu đãi của nhóm khách (mục 5.4) |
3. **Tour đính kèm** – hai cách:
   - Tích **"Tự chèn tour gợi ý theo dự đoán của từng khách"**: mỗi khách nhận tour **khác nhau** theo điểm đến dự đoán của họ.
   - Hoặc tích chọn tour cụ thể (tour **Mới** là tour mở bán trong 30 ngày).
4. **Thời gian gửi** – để trống = gửi khi bấm "Gửi ngay"; hoặc chọn giờ hẹn.

**Khung "Xem trước" bên phải:** email đúng như khách sẽ nhận. Đổi tên khách ở ô chọn để thấy mỗi người nhận nội dung, tour khác nhau.

**Quy trình gửi:**

```
Lưu  →  (Gửi thử về email của bạn)  →  Duyệt  →  Gửi ngay   (hoặc tự gửi lúc hẹn giờ)
```

- **Sửa nội dung sau khi duyệt** → chiến dịch quay về "Đang soạn", phải duyệt lại.
- **Dừng**: các email chưa gửi sẽ không gửi nữa.
- **Nhân bản** (ở danh sách): tạo chiến dịch mới giống chiến dịch cũ để sửa và gửi lại.

**Kết quả** (sau khi gửi): đã gửi / chờ / lỗi, bị loại, **mở**, **bấm**, **hủy nhận tin**, **mua lại trong 30 ngày** (khách nhận email rồi có đơn mới trên Tourwell, kèm doanh thu).

### 5.6 Chăm sóc tự động

**Dùng để:** bật / tắt và chỉnh 11 hành trình hệ thống tự gửi mỗi ngày.

| Hành trình | Loại | Gửi khi |
|---|---|---|
| Xác nhận đã nhận thanh toán | Giao dịch | Kế toán duyệt phiếu thu của khách (sáng hôm sau) |
| Nhắc thanh toán | Giao dịch | Khách còn nợ, còn 10 ngày rồi 3 ngày tới ngày đi |
| Nhắc chuẩn bị | Giao dịch | Còn 1–3 ngày tới ngày đi (gộp nhắc thanh toán nếu còn nợ) |
| Cảm ơn | Giao dịch | Ngày sau khi khách về |
| **Kiểm tra giấy tờ** | Giao dịch | Chuyến đi trong 60 ngày tới có hộ chiếu không đủ hạn / chưa có visa (xem mục 6) |
| Gợi ý chuyến tiếp theo | Chăm sóc | 45 ngày sau khi về |
| **Kỷ niệm 1 năm** | Chăm sóc | Đúng 1 năm sau ngày khởi hành |
| **Hộ chiếu sắp hết hạn** | Chăm sóc | Hộ chiếu hết hạn trong 9 tháng tới |
| Đánh thức khách cũ | Chăm sóc | Nhóm Cần giữ chân, Ngủ đông (tối đa 1 lần / quý) |
| Nuôi dưỡng tiềm năng | Chăm sóc | Nhóm Tiềm năng ấm (1 lần / tháng) |
| Sinh nhật | Chăm sóc | Đúng ngày sinh (nếu Tourwell có ngày sinh) |

**Quy tắc chung:**
- **Mỗi email chỉ gửi một lần** (chạy lại cũng không gửi trùng).
- **Mỗi khách tối đa một tin chăm sóc mỗi ngày**; nếu một khách cùng lúc đủ điều kiện nhiều hành trình, tin còn lại để hôm sau.

**Thao tác:**
- Tích / bỏ tích để bật / tắt, sửa các mốc ngày, bấm **Lưu**.
- Mở mục **Mẫu tin chăm sóc** để sửa tiêu đề, nội dung từng hành trình (dùng được các biến như chiến dịch, thêm `{{diem_den_ky_niem}}`, `{{han_ho_chieu}}`).
- **Xem trước**: danh sách email sẽ gửi hôm nay; bấm một dòng để xem nội dung. Phía dưới là danh sách "Không gửi được" kèm lý do.
- **Chạy ngay**: đưa vào hàng đợi, gửi luôn và tạo việc cho sale (không cần chờ 9h).

### 5.7 Tour & dịch vụ

Mọi thứ có thể giới thiệu cho khách: sản phẩm trên Tourwell (tour, **visa**, thuê xe…, có cột Loại) và **Dịch vụ AdenZ** không có sản phẩm trên Tourwell (vé máy bay, khách sạn, bảo hiểm, đưa đón…, sửa ở Cài đặt → Dịch vụ AdenZ). Trong **Chiến dịch** đính kèm được cả hai, và chọn khách theo **đã dùng / chưa từng dùng dịch vụ**, **hạng thành viên**, **khách từng hỏi qua KMV Checker**.


Danh sách tour đang bán (lấy từ Tourwell), có nhãn **Mới** cho tour mở bán trong 30 ngày. Chỉ để xem; tour được dùng khi soạn chiến dịch.

### 5.8 Quy tắc giấy tờ (mở từ Cài đặt → Thiết lập khác)

**Dùng để:** bộ phận visa khai báo quy định từng điểm đến (cho khách quốc tịch Việt Nam).

| Cột | Ý nghĩa | Ví dụ |
|---|---|---|
| Điểm đến | Phải trùng tên hệ thống nhận diện từ tên tour | Nhật Bản, Châu Âu |
| Cần visa | Tích nếu khách VN cần visa | Nhật: có; Thái Lan: không |
| Hộ chiếu còn hạn tối thiểu (tháng) | Số tháng hộ chiếu phải còn hạn | 6; Châu Âu: 3 |
| Tính từ ngày | Tính từ ngày **khởi hành** hay ngày **về** | Châu Âu tính từ ngày về |
| Thời gian làm visa (ngày) | Để tính hạn nộp hồ sơ | Nhật: 14 |
| Ghi chú | Tự do | "Cần xác nhận" |

> **Giá trị ban đầu chỉ là gợi ý.** Quy định thay đổi theo thời gian; bộ phận visa phải kiểm tra lại trước khi bật gửi cho khách thật.

### 5.9 Lịch sử gửi

Mọi email đã gửi hoặc bị bỏ qua: thời gian, khách, nguồn (chiến dịch nào / hành trình nào), trạng thái (**Đã gửi**, **Chờ gửi**, **Lỗi**, **Bỏ qua** kèm lý do), đã mở / đã bấm. Nút **Gửi các tin đang chờ** để gửi ngay phần đang xếp hàng.

### 5.10 Cài đặt

| Mục | Làm gì |
|---|---|
| **Dữ liệu** | Nút **Đồng bộ và chấm điểm ngay** (thay vì chờ 2h sáng) |
| **Kết nối Tourwell** | Địa chỉ API + token; bỏ tích "Dùng dữ liệu mẫu" để dùng dữ liệu thật |
| **Email gửi** | Gmail / email công ty + mật khẩu ứng dụng; **Email nhận thử** (mọi email chuyển về đây); nút Kiểm tra đăng nhập, Gửi thử |
| **Chính sách gửi** | Số tin quảng cáo tối đa / khách / tuần; tốc độ gửi; khung giờ không gửi quảng cáo; tiền tố tiêu đề quảng cáo; địa chỉ công khai của hệ thống; giờ đồng bộ đêm |
| **Trọng số điểm tiềm năng** | Sửa các con số ở mục 2.3; lưu xong hệ thống chấm lại ngay |
| **Tài khoản** | Thêm tài khoản Marketing, Sếp, Quản trị (chỉ Quản trị thêm được) |

---

### Ai dùng AdenZ Care

| Người | Dùng thế nào |
|---|---|
| **Nhân viên sale, visa, kế toán** | **Không cần tài khoản.** Làm việc trên Tourwell như cũ; nhận email cảnh báo (lead mới, khách cần chăm sóc, đơn còn nợ) có link mở thẳng trên Tourwell. Nhập email nhân viên ở **Cài đặt → Quy trình chăm sóc → Nhân viên nhận cảnh báo** |
| **Marketing** | Tài khoản Marketing: soạn chiến dịch, sửa mẫu tin tự động, xem Theo dõi chăm sóc, Báo cáo |
| **Sếp, Quản trị** | Xem mọi thứ, nhận báo cáo tuần và cảnh báo lead chậm tiếp nhận qua email, cài đặt |

### Khảo sát sau chuyến đi (khách thấy gì)

2 ngày sau ngày về, khách nhận email cảm ơn có 11 nút điểm 0–10. Bấm một số → trang của AdenZ hiện điểm đã chọn và ô góp ý → khách bấm **Gửi đánh giá** thì điểm mới được ghi (mở link không ghi điểm, tránh trình quét thư bấm nhầm). Điểm 0–6: trang báo "quản lý sẽ liên hệ trong 24 giờ", sếp có việc gấp. Điểm 9–10: hôm sau khách nhận email mời đánh giá, giới thiệu bạn bè (cần điền link đánh giá trong Cài đặt → Quy trình chăm sóc).

## Chăm sóc đối tác (đại lý, doanh nghiệp)

Đối tác nhận đủ tin phục vụ như khách lẻ, cộng thêm các tin dưới đây. **Mọi email gửi đối tác** có:
- nút **"Gửi yêu cầu cho AdenZ"**: đối tác chọn loại yêu cầu (cần báo giá, giữ chỗ / đặt dịch vụ, hỏi chính sách hợp tác / hoa hồng, góp ý / phản ánh, khác), nhập nội dung, số khách, thời gian. Nhân viên phụ trách nhận **email ngay**; mục tự đánh dấu đã xử lý khi Tourwell có lead, đơn hoặc ghi nhận chăm sóc mới cho đối tác đó;
- **trả lời trực tiếp** email thì thư về **hộp thư nhân viên phụ trách** (email nhập ở Cài đặt → Nhân viên nhận cảnh báo).

| Tin | Khi nào | Dữ liệu |
|---|---|---|
| **Báo cáo sau chuyến đi** | 2 ngày sau ngày về của đơn đối tác | Mã đơn, tên chuyến, ngày đi, ngày về, số hành khách, điểm khảo sát của khách (nếu có) |
| **Tổng kết hợp tác quý** | 7 ngày đầu tháng 1, 4, 7, 10; đối tác có đơn trong quý trước | Số đơn, tổng giá trị, nhóm dịch vụ đã dùng trong quý; chính sách hợp tác |
| **Bản tin mùa vụ** | Mỗi mùa một lần: T1–2 Canton Fair kỳ xuân, T3–4 hè, T7 Canton Fair kỳ thu, T8–9 du lịch cuối năm, T10–11 Tết | Tên mùa; chính sách hợp tác; có link hủy nhận. Không bị chặn vì "sắp khởi hành" (đại lý gần như luôn có đoàn) |
| **Chiến dịch cho đối tác** | Marketing / Sếp soạn, duyệt | Chọn "Chỉ gửi đối tác" (đại lý, doanh nghiệp, cơ quan). Mẫu nhanh: bản tin giá mùa cao điểm, chính sách hoa hồng, mời tham gia sự kiện, cập nhật quy định visa |

**Chính sách hợp tác, hoa hồng** do sếp quyết định, nhập ở Cài đặt → Quy trình chăm sóc, được chèn vào email đối tác ở chỗ `{{chinh_sach}}` (để trống thì không hiện).

Trang **Theo dõi chăm sóc** có mục **Trao đổi với đối tác**: mọi yêu cầu, ai phụ trách, đã xử lý chưa. Báo cáo có chỉ số "Yêu cầu của đối tác được xử lý trên Tourwell".

## 6. Kiểm tra giấy tờ hoạt động thế nào (ví dụ cụ thể)

Khách **Lê Văn Hoa** đặt tour **Nhật Bản**, khởi hành sau 25 ngày. Hộ chiếu hết hạn sau ~4 tháng, chưa có visa.

Mỗi sáng hệ thống làm:

1. Lấy các đơn khởi hành trong **60 ngày tới** → có đơn của khách Hoa.
2. Tra bảng quy tắc **Nhật Bản**: cần visa; hộ chiếu còn hạn **6 tháng** tính từ ngày **khởi hành**; làm visa **14 ngày**.
3. Kiểm tra từng hành khách của đơn:
   - Hộ chiếu cần còn hạn đến *ngày đi + 6 tháng*, nhưng chỉ còn 4 tháng → **không đủ**.
   - Chưa có visa → hạn nộp hồ sơ = *ngày đi − 14 ngày − 7 ngày dự phòng*.
4. Gửi khách **một email** về hộ chiếu (tin giao dịch, không có link hủy).
5. Tạo **2 việc** cho sale phụ trách: "tư vấn làm hộ chiếu mới gấp", "hạn nộp hồ sơ visa ngày …".

**Về visa:** mặc định hệ thống **chỉ báo sale**, không email khách "chưa có visa". Lý do: kiểm tra dữ liệu Tourwell thật (29/10/2026) cho thấy chưa hành khách nào được đánh dấu "đã có visa", nghĩa là ô này chưa được nhập; nếu email khách thì sẽ nhắc nhầm cả người đã có visa. Khi công ty nhập đầy đủ ô visa, bật tùy chọn **"Gửi email nhắc chưa có visa cho khách"** ở trang Chăm sóc tự động.

Nếu hành khách **chưa có ngày hết hạn hộ chiếu trên Tourwell**: hệ thống **không** email khách (không có gì để nói), chỉ tạo việc cho sale "hỏi khách và cập nhật Tourwell".

> Điều kiện để chạy thật: nhân viên phải **nhập ngày hết hạn hộ chiếu và tình trạng visa** của hành khách trên Tourwell. Hiện tại (29/10/2026) **0/75 hành khách có ngày hết hạn hộ chiếu**, nên trên dữ liệu thật tính năng này mới chỉ tạo việc "hỏi khách và cập nhật" cho sale.

---

## 7. Bài thử tay (khoảng 30 phút)

Làm lần lượt để hiểu hệ thống.

### Bài 1 – Đọc tổng quan và hồ sơ khách
1. Mở **Tổng quan**. Ghi lại: bao nhiêu khách VIP, bao nhiêu tiềm năng nóng.
2. Bấm tên một khách trong "Tiềm năng nóng". Đọc phần **lý do điểm**: cộng các con số lại có đúng bằng điểm không?
3. Bấm tên một khách trong "Khách cũ có khả năng mua cao". Xem **điểm đến gợi ý** có phải nơi khách **chưa đi** không.

### Bài 2 – Nhận email thật vào Gmail của bạn
1. **Cài đặt → Email gửi**: bấm **Gmail**, nhập Gmail và mật khẩu ứng dụng (cách lấy: myaccount.google.com/apppasswords). Ô **Email nhận thử**: Gmail của bạn. **Lưu** → **Kiểm tra đăng nhập**.
2. Từ giờ **mọi email** hệ thống gửi (kể cả cho khách mẫu) đều về Gmail của bạn, tiêu đề có `[THỬ → khach…@example.com]`.

> Chưa cài email: email không đi đâu cả, chỉ được lưu thành tệp trong `data\outbox` (mở bằng Outlook hoặc trình duyệt được).

### Bài 3 – Tạo và gửi một chiến dịch
1. **Chiến dịch → + Tạo chiến dịch**. Tên: "Thử tour mới cho VIP".
2. Tích nhóm **VIP**. Xem ô xanh: bao nhiêu khách nhận.
3. Tiêu đề: `{{ten}} ơi, tour mới dành cho bạn`. Nội dung có `{{uu_dai}}`.
4. Giữ tích **"Tự chèn tour gợi ý"**. Ở khung Xem trước, đổi qua vài khách: tour gợi ý khác nhau.
5. **Lưu** → nhập Gmail ở ô **Gửi thử** → kiểm tra Gmail.
6. **Duyệt** → **Gửi ngay** → xem phần **Kết quả**.
7. Thử **sửa tiêu đề** một chiến dịch đã duyệt nhưng chưa gửi: trạng thái quay về "Đang soạn".

### Bài 4 – Thử hủy nhận tin
1. Mở một email chiến dịch trong Gmail (từ bài 3), kéo xuống cuối, bấm **"Hủy nhận tin"**.
2. Trang mở ra hỏi xác nhận → bấm **Xác nhận hủy nhận tin**.
3. Vào **Khách hàng**, tìm khách đó: có nhãn **từ chối**. Tạo chiến dịch mới chọn lại nhóm cũ: khách đó nằm trong "bị loại – Đã từ chối nhận tin".
4. Muốn cho nhận lại: mở hồ sơ khách → **Cho nhận lại**.

> Trong bản demo, link chỉ mở được **trên chính máy đang chạy** hệ thống (địa chỉ localhost). Khi lên máy chủ thật, link dùng tên miền công ty.

### Bài 5 – Chăm sóc tự động và việc cần làm
1. **Chăm sóc tự động → Xem trước**. Đếm: bao nhiêu email "Kiểm tra giấy tờ", "Hộ chiếu sắp hết hạn", "Kỷ niệm 1 năm".
2. Bấm một dòng "Kiểm tra giấy tờ" để đọc email.
3. Bấm **Chạy ngay**. Thông báo cho biết số tin đưa vào hàng đợi và số việc đã tạo.
4. Mở **Việc cần làm**: thấy các việc mới. Bấm **Xong** một việc.
5. Bấm **Chạy ngay** lần nữa: **0 tin mới** (không gửi trùng).

### Bài 6 – Đổi quy tắc giấy tờ
1. Mở **Tổng quan**, ghi lại số ở ô **"Vấn đề giấy tờ chuyến sắp đi"**.
2. **Quy tắc giấy tờ**: bỏ tích "Cần visa" của **Nhật Bản** → **Lưu quy tắc**.
3. Về **Tổng quan**: ô "Vấn đề giấy tờ" giảm 1 (hết cảnh báo visa Nhật; cảnh báo hộ chiếu vẫn còn).
4. Tích lại như cũ.

> Nếu đã làm Bài 5 thì "Xem trước" ở Chăm sóc tự động sẽ không hiện lại email giấy tờ, vì email đó đã gửi rồi (mỗi email chỉ gửi một lần). Ô ở Tổng quan thì luôn tính lại theo quy tắc hiện tại.

### Bài 7 – Chỉnh trọng số điểm
1. **Cài đặt → Trọng số điểm tiềm năng**: đổi "Đã có báo giá" từ 15 thành 40 → **Lưu và chấm lại**.
2. Thông báo cho biết bao nhiêu khách **đổi nhóm**. Về **Tổng quan**: số tiềm năng nóng thay đổi.
3. Đổi lại 15.

---

### Bài 8 – Trình diễn cho sếp (15 phút)

Chuẩn bị: xóa thư mục `data\care`, chạy `npm run care`, tạo tài khoản quản trị. Vào **Cài đặt → Email gửi** điền Gmail gửi và **Email nhận thử** là Gmail của bạn (mọi email chuyển về đây). Vào **Cài đặt → Quy trình chăm sóc → Nhân viên nhận cảnh báo**, điền Gmail của bạn cho "Hùng (#4)". Vào **Chăm sóc tự động** bấm **Chạy ngay**.

1. **Khách nhận gì:** mở Gmail: email xác nhận đơn, nhắc check-in, cảm ơn + khảo sát 0–10 (thử bấm số 4 rồi Gửi đánh giá), nhắc thanh toán.
2. **Nhân viên nhận gì:** Cài đặt → **Gửi email cảnh báo ngay** → Gmail nhận danh sách khách cần chăm sóc của Hùng, mỗi dòng có link mở trên Tourwell. Nhấn mạnh: nhân viên không phải vào hệ thống mới.
3. **Theo dõi chăm sóc:** 8 ô số liệu; khách vừa chấm 4 điểm xuất hiện ở "Khách tương tác" và có cảnh báo **Phàn nàn** gấp cho sếp; bảng **Hiệu quả từng loại tin**.
4. **Dịch vụ:** Khách hàng → lọc "Vé máy bay". Chiến dịch → chọn "Đã dùng: Vé máy bay", "Chưa từng dùng: Bảo hiểm", đính kèm dịch vụ **Bảo hiểm du lịch** → xem trước email.
5. **Visa Hàn:** mở hồ sơ một khách → Kết quả visa: Hàn Quốc, Nhiều lần 10 năm, Được cấp → khách vào nhóm nhận tin Hàn Quốc theo mùa.
6. **Báo cáo:** 15 chỉ số; bấm **Gửi báo cáo qua email ngay**.

## 8. Câu hỏi thường gặp

**Hệ thống có sửa dữ liệu trên Tourwell không?**
Không. Chỉ đọc. Việc cần làm nằm trong AdenZ Care, không ghi vào Tourwell.

**Dữ liệu mẫu và dữ liệu thật khác gì?**
Dữ liệu mẫu do hệ thống tự tạo để thử. Khi kết nối Tourwell (Cài đặt → Kết nối Tourwell, bỏ tích "Dùng dữ liệu mẫu", bấm Đồng bộ), toàn bộ khách, đơn, tour là của công ty.

**Vì sao chiến dịch báo "0 khách nhận"?**
Điều kiện lọc quá hẹp, hoặc các khách đều bị loại (xem lý do ở ô xanh / phần "khách bị loại").

**Vì sao email đã gửi mà "Mở" vẫn là 0?**
Đếm lượt mở dựa vào một ảnh nhỏ trong email. Trong bản demo, ảnh nằm ở địa chỉ localhost nên Gmail không tải được → không đếm được. Lượt **bấm** vẫn đếm được nếu bấm trên máy chạy hệ thống. Khi lên máy chủ thật, cả hai đều hoạt động. (Một số hộp thư chặn ảnh nên lượt mở luôn thấp hơn thực tế.)

**Khách đã hủy nhận tin có còn nhận email xác nhận thanh toán không?**
Có. Hủy nhận tin chỉ ngừng email giới thiệu, ưu đãi; email liên quan chuyến đi vẫn gửi.

**Tôi bấm "Chạy ngay" nhiều lần có gửi trùng không?**
Không. Mỗi email có mã riêng, đã gửi thì không gửi lại.

**Muốn thử lại từ đầu?**
Tắt chương trình, xóa thư mục `data\care`, chạy lại `npm run care`.

**Zalo, SMS ở đâu?**
Chưa có trong bản này. Làm ở giai đoạn 2, sau khi Sếp duyệt và cấp quyền Zalo OA.

---

## 9. Thuật ngữ

| Từ | Nghĩa |
|---|---|
| Lead | Yêu cầu tư vấn của khách trên Tourwell |
| RFM | 3 điểm: Gần đây (R), Tần suất (F), Giá trị (M) |
| Điểm tiềm năng | 0–100, đo khả năng chốt của khách chưa mua |
| Nhóm / phân khúc | Cách chia khách để chăm sóc khác nhau |
| Hành trình tự động | Email hệ thống tự gửi theo quy tắc, không cần ai bấm |
| Chiến dịch | Email do Marketing / Sếp soạn, duyệt và gửi cho một nhóm khách |
| Tin giao dịch | Email liên quan đơn hàng, chuyến đi của khách |
| Tin quảng cáo | Email giới thiệu, ưu đãi; có link hủy nhận tin |
| Hàng đợi | Danh sách email chờ gửi dần |
| Chế độ thử | Mọi email chuyển về "Email nhận thử", không tới khách |
| Đồng bộ | Đọc dữ liệu mới từ Tourwell |
