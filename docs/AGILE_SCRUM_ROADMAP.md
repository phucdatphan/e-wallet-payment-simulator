# Chuỗi 3 Dự Án Liên Hoàn (3 Stages) — Hệ Thống Thanh Toán Ví Điện Tử

> **Mô hình**: 3 Giai đoạn (Stages) nối tiếp nhau theo vòng đời sản phẩm thực tế (End-to-End Product Lifecycle) kết hợp **Agile / Scrum**.  
> **Điểm liên kết**: Đầu ra (Output) của giai đoạn trước là đầu vào (Input) trực tiếp của giai đoạn sau.

```
[Giai đoạn 1: Project 1] ──(BRD/SRS + API Node.js)──> [Giai đoạn 2: Project 2] ──(Go-live + Dữ liệu thật)──> [Giai đoạn 3: Project 3]
  Xây dựng Lõi & Kiến trúc                              UX, Agile Spec & UAT                                   Phân tích & Đối soát 3 bên
```

---

## Giai Đoạn 1 (Stage 1): Project 1 — Xây Dựng Lõi Hệ Thống & Đặc Tả Nghiệp Vụ
- **Thư mục**: `e-wallet-payment-simulator`
- **Vai trò**: Solution Architect & Business Analyst (Khởi tạo nền tảng).
- **Nội dung chính**:
  - Phân tích bài toán kinh doanh và viết tài liệu đặc tả gốc ([BUSINESS_ANALYSIS.md](file:///Users/admin2004/.gemini/antigravity/scratch/e-wallet-payment-simulator/docs/BUSINESS_ANALYSIS.md)).
  - Xây dựng 2 máy chủ Node.js giả lập (`localhost:3000` Merchant & `localhost:4000` Gateway) với cơ chế **giữ kho 15 phút**, **chữ ký HMAC-SHA256**, **Webhook IPN** và **Idempotency**.
- **Đầu ra chuyển giao sang Giai đoạn 2**:
  - Tài liệu BRD/SRS làm nguồn viết User Stories.
  - Các API thật (`/api/payment/create`, `/api/payment/callback`, `/v2/gateway/pay/confirm`, `/v2/gateway/pay/query`) để kiểm thử trực tiếp.

---

## Giai Đoạn 2 (Stage 2): Project 2 — Thiết Kế UX, Đặc Tả Agile & Kiểm Thử UAT
- **Thư mục**: `e-wallet-checkout-ux-uat`
- **Vai trò**: IT Business Analyst & QA Lead (Chuẩn hóa trước khi Go-live).
- **Liên kết với Giai đoạn 1**: Hiện thực hóa toàn bộ luồng nghiệp vụ từ `BUSINESS_ANALYSIS.md` thành giao diện và bộ kiểm thử chạy trực tiếp trên Backend Node.js của Project 1.
- **Tổ chức theo Agile / Scrum**:
  - **Sprint 1 (Giao diện & Luồng chính)**:
    - 5 màn hình Wireframe cốt lõi ([user-journey-wireframes.html](file:///Users/admin2004/.gemini/antigravity/scratch/e-wallet-checkout-ux-uat/wireframes/user-journey-wireframes.html)) & Figma: https://www.figma.com/design/eedWAY1oMYerrjZztJNXIc?node-id=4-3&autoplay-code-preview=4-3
  - **Sprint 2 (Bảo mật, Ngoại lệ & Nghiệm thu UAT)**:
    - 10 User Stories chuẩn `Given - When - Then` ([user-stories-ac.md](file:///Users/admin2004/.gemini/antigravity/scratch/e-wallet-checkout-ux-uat/user-stories-ac.md)).
    - 26 Kịch bản kiểm thử UAT ([uat-test-cases.csv](file:///Users/admin2004/.gemini/antigravity/scratch/e-wallet-checkout-ux-uat/uat-test-cases.csv)).
    - Bộ Postman Collection test trực tiếp API Project 1 ([e-wallet-payment-simulator.postman_collection.json](file:///Users/admin2004/.gemini/antigravity/scratch/e-wallet-checkout-ux-uat/postman/e-wallet-payment-simulator.postman_collection.json)).
- **Đầu ra chuyển giao sang Giai đoạn 3**:
  - Hệ thống đạt chuẩn **Definition of Done (DoD)** và được phê duyệt **Go-live Production**.

---

## Giai Đoạn 3 (Stage 3): Project 3 — Vận Hành Sau Ra Mắt, Phân Tích & Đối Soát 3 Bên
- **Thư mục**: `e-wallet-post-launch-analytics`
- **Vai trò**: Data-Driven ITBA (Đo lường & Tối ưu sau 30 ngày Go-live).
- **Liên kết với Giai đoạn 1 & 2**:
  - Cấu trúc 3 bảng dữ liệu (`merchant_orders`, `gateway_transactions`, `bank_settlements`) khớp hoàn toàn với luồng trạng thái (`Created`, `Paid`, `Expired`, `Failed`) và cơ chế IPN đã thiết kế ở Project 1 & Project 2.
- **Tổ chức theo Agile / Scrum (Sprint 3 & Retrospective)**:
  - **Sinh dữ liệu 30 ngày vận hành**: 10,500 đơn hàng có chèn ~1–2% lỗi lệch tiền & thiếu IPN ([generate_data.py](file:///Users/admin2004/.gemini/antigravity/scratch/e-wallet-post-launch-analytics/generate_data.py)).
  - **7 Truy vấn SQL (CTE & Window Functions)**: Đo phễu chuyển đổi (Drop-off **24.07%** ở bước QR), độ trễ giờ cao điểm (**2,502 ms** lúc 19h–21h), và **Đối soát 3 bên** ([analytics_queries.sql](file:///Users/admin2004/.gemini/antigravity/scratch/e-wallet-post-launch-analytics/analytics_queries.sql)).
  - **Dashboard & Cải tiến**: [README.md](file:///Users/admin2004/.gemini/antigravity/scratch/e-wallet-post-launch-analytics/README.md) & Figma: https://www.figma.com/design/3KZYUyxTCNIUQi0isXUejF?node-id=3-3&autoplay-code-preview=3-3
- **Vòng lặp phản hồi (Feedback Loop)**: Các đề xuất từ Giai đoạn 3 (thêm Deep-link giảm rớt đơn QR, dùng Message Queue giảm độ trễ IPN) trở thành **Product Backlog** cho vòng Sprint tiếp theo.
