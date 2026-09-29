# ระบบแดชบอร์ดสรุปงบประมาณ สปสช. แบบเรียลไทม์ (NHSO SMT Budget Dashboard)

ระบบ Dashboard ติดตามและวิเคราะห์ข้อมูลงบประมาณจากระบบ Smart Monitoring & Tracking (SMT) สำนักงานหลักประกันสุขภาพแห่งชาติ (สปสช.)

---

## สถาปัตยกรรมระบบ (Architecture)
- **Backend Gateway:** FastAPI (Python 3.11) ทำหน้าที่เป็น API Proxy, Data Transformation, In-Memory Caching (TTL 10 นาที) เพื่อลดโหลด Upstream และคำนวณ KPI Aggregations เบื้องหลัง
- **Frontend Dashboard:** React 19 + TypeScript + Vite + Apache ECharts + Lucide Icons + XLSX Export
- **Upstream SMT API:** เชื่อมต่อไปยัง `https://smt.nhso.go.th/smtf/api/budgetreport/budgetSummaryByVendorReport/search` โดยตรง

---

## ลิงก์เข้าใช้งานระบบขณะนี้ (Currently Running)
- 🌐 **Web Dashboard:** [http://localhost:5173](http://localhost:5173)
- 📡 **Backend API & Swagger Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- 🩺 **Backend Health Check:** [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

---

## วิธีเปิดใช้งานโปรเจกต์ (How to Run)

### 1. เปิด Backend Gateway
```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. เปิด Frontend Dashboard
```bash
cd frontend
cmd.exe /c "npm run dev"
```

---

## คุณสมบัติเด่นของระบบที่พัฒนาแล้ว:
1. **Dynamic Filtering:** เลือกปีงบประมาณ พ.ศ. (คำนวณช่วงวันที่โอนเริ่มต้น-สิ้นสุด 01/10 ถึง 30/09 ให้โดยอัตโนมัติ), ค้นหาตามรหัส 5 หลัก และเลือกเขตพื้นที่ สปสช. (1-13)
2. **KPI Cards:** สรุปยอดวงเงินจัดสรรรวม (Amount), ยอดโอนสุทธิ (Net Total), ยอดเงินรอดำเนินการ (Wait), และยอดหักหนี้/VAT
3. **Disbursement Trend Chart:** กราฟแท่งและเส้นเปรียบเทียบยอดจัดสรรกับยอดโอนสุทธิแยกตามรายเดือน (MM/YYYY)
4. **Fund Group Breakdown:** แผนภูมิวงแหวนสัดส่วนงบประมาณตามกลุ่มกองทุน (Medical care, OP, IP ฯลฯ)
5. **Interactive Data Table:** แสดงตารางรายการธุรกรรมพร้อม Search ฟิลเตอร์ข้อความ, Pagination และลิงก์ดาวน์โหลดเอกสารจาก สปสช.
6. **Excel Export:** ปุ่มดาวน์โหลดข้อมูลชุดที่กรองแล้วเป็นไฟล์ `.xlsx` ได้ทันที
7. **Auto-refresh & Caching:** รองรับการตั้ง Polling อัตโนมัติ (5 นาที, 15 นาที, 30 นาที) และระบบแคชลดภาระเซิร์ฟเวอร์
