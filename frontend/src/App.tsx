import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';
import * as XLSX from 'xlsx';
import {
  TrendingUp,
  DollarSign,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  GitFork,
  Calendar
} from 'lucide-react';
import './index.css';

interface BudgetRecord {
  fiscalYear?: string;
  runDt: string;
  batchNo: string;
  postingDate: string;
  refDocNo: string;
  vndrNo: string;
  fundName: string;
  fundGroup: number;
  fundGroupDescr: string;
  fundDescr: string;
  mouGrpCode: string;
  pmntMetd: string;
  bankNm: string;
  pmntStts: string;
  amount: number;
  wait: number;
  debt: number;
  bond: number;
  odbt: number;
  vat: number;
  total: number;
  mophId?: string;
  efundDesc?: string;
  downloadPAYMFileName?: string;
  downloadUrl?: string;
  fileName?: string;
  [key: string]: any;
}

interface BudgetSummary {
  recordCount: number;
  totalAmount: number;
  totalNetPayment: number;
  totalWait: number;
  totalDebt: number;
  totalVat: number;
  totalBond?: number;
  totalOdbt?: number;
}

const API_BASE = import.meta.env.VITE_API_BASE || '';
const AVAILABLE_YEARS = ['2569', '2568', '2567', '2566', '2565'];

export default function App() {
  // Multi-Year Filter States
  const [selectedYears, setSelectedYears] = useState<string[]>(['2567']);
  const [vendorId5Digit, setVendorId5Digit] = useState('11152');
  const [zoneId, setZoneId] = useState('');
  
  // Fund & SubFund Filter State
  const [selectedFund, setSelectedFund] = useState<string>('ALL');
  const [selectedSubFund, setSelectedSubFund] = useState<string>('ALL');

  // Realtime Polling
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  
  // Data States
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [records, setRecords] = useState<BudgetRecord[]>([]);
  const [dataSource, setDataSource] = useState<string>('');
  
  // Table search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const pageSize = 15;

  // Toggle year selection
  const handleToggleYear = (year: string) => {
    setSelectedYears(prev => {
      if (prev.includes(year)) {
        if (prev.length === 1) return prev; // Keep at least one year
        return prev.filter(y => y !== year);
      } else {
        return [...prev, year].sort().reverse();
      }
    });
  };

  const fetchData = async (forceRefresh = false) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await axios.post(`${API_BASE}/api/budget/search`, {
        budgetYears: selectedYears,
        vendorId5Digit: vendorId5Digit.trim(),
        zoneId: zoneId.trim(),
        vendorSearchConditionCode: '2',
        budgetSource: '',
        forceRefresh
      });

      const resData = response.data;
      setDataSource(resData.source);
      if (resData.data) {
        setRecords(resData.data.datas || []);
      }
      setLastUpdated(new Date().toLocaleTimeString('th-TH'));
      setCurrentPage(1);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบ สปสช.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedYears]);

  // Polling Effect
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, selectedYears, vendorId5Digit, zoneId]);

  // Helper to calculate Fiscal Year from record (1 Oct - 30 Sep belongs to fiscal year)
  const getRecordFiscalYear = (r: BudgetRecord): string => {
    const pDate = String(r.postingDate || '');
    if (pDate.length >= 6) {
      const year = parseInt(pDate.substring(0, 4), 10);
      const month = parseInt(pDate.substring(4, 6), 10);
      if (!isNaN(year) && !isNaN(month)) {
        return String(month >= 10 ? year + 1 : year);
      }
    }
    const runDt = String(r.runDt || '');
    if (runDt.length >= 7) {
      const parts = runDt.split('-');
      const gy = parseInt(parts[0], 10);
      const gm = parseInt(parts[1], 10);
      if (!isNaN(gy) && !isNaN(gm)) {
        const by = gy + 543;
        return String(gm >= 10 ? by + 1 : by);
      }
    }
    return r.fiscalYear || selectedYears[0] || '2568';
  };

  const thaiMonthNames: { [key: string]: string } = {
    '01': 'ม.ค.', '02': 'ก.พ.', '03': 'มี.ค.', '04': 'เม.ย.',
    '05': 'พ.ค.', '06': 'มิ.ย.', '07': 'ก.ค.', '08': 'ส.ค.',
    '09': 'ก.ย.', '10': 'ต.ค.', '11': 'พ.ย.', '12': 'ธ.ค.'
  };

  // Helper to normalize fund name (handles wording changes across fiscal years)
  const normalizeFundName = (rawName: string | undefined): string => {
    if (!rawName) return '';
    let name = rawName.trim();
    if (!name) return '';
    if (name.includes('สร้างเสริมสุขภาพ') && name.includes('ป้องกันโรค')) {
      return 'กองทุนสร้างเสริมสุขภาพและป้องกันโรค';
    }
    if ((name.includes('ควบคุม') && name.includes('ป้องกัน') && name.includes('เรื้อรัง')) || name.includes('เบาหวานและความดันโลหิตสูง')) {
      return 'บริการควบคุม ป้องกัน และรักษาโรคเรื้อรัง';
    }
    if (name.includes('บริการทางการแพทย์') || name.includes('ผู้ป่วยใน') || name.includes('ผู้ป่วยนอก')) {
      return 'กองทุนค่าบริการทางการแพทย์';
    }
    if (name.includes('กำไรสะสม')) {
      return 'กำไรสะสม';
    }
    if (name.includes('สาธารณสุขเพิ่มเติม') && name.includes('ปฐมภูมิ')) {
      return 'ค่าบริการสาธารณสุขเพิ่มเติมสำหรับบริการระดับปฐมภูมิ';
    }
    return name;
  };

  // Extract unique normalized fund names list from current records
  const availableFunds = useMemo(() => {
    const fundsSet = new Set<string>();
    records.forEach(r => {
      const raw = r.fundGroupDescr || r.fundName;
      const normalized = normalizeFundName(raw);
      if (normalized) fundsSet.add(normalized);
    });
    return Array.from(fundsSet).sort();
  }, [records]);

  // Extract unique subfund names list (กองทุนย่อยเฉพาะด้าน) based on selectedFund
  const availableSubFunds = useMemo(() => {
    const subFundsSet = new Set<string>();
    records.forEach(r => {
      const rawFund = r.fundGroupDescr || r.fundName;
      const fund = normalizeFundName(rawFund);
      if (selectedFund === 'ALL' || fund === selectedFund) {
        const sub = (r.efundDesc || r.fundDescr || '').trim();
        if (sub) subFundsSet.add(sub);
      }
    });
    return Array.from(subFundsSet).sort();
  }, [records, selectedFund]);

  // Format Currency
  const formatCurrency = (val: number | undefined) => {
    if (val === undefined || val === null) return '0.00';
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  // Filtered records by Normalized Fund, SubFund, and Search Term
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const raw = r.fundGroupDescr || r.fundName || '';
      const fund = normalizeFundName(raw);
      if (selectedFund !== 'ALL' && fund !== selectedFund) {
        return false;
      }
      const sub = (r.efundDesc || r.fundDescr || '').trim();
      if (selectedSubFund !== 'ALL' && sub !== selectedSubFund) {
        return false;
      }
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (r.refDocNo && r.refDocNo.toLowerCase().includes(term)) ||
        (raw && raw.toLowerCase().includes(term)) ||
        (fund && fund.toLowerCase().includes(term)) ||
        (r.efundDesc && r.efundDesc.toLowerCase().includes(term)) ||
        (r.postingDate && String(r.postingDate).includes(term)) ||
        (r.batchNo && String(r.batchNo).includes(term)) ||
        (r.mophId && String(r.mophId).includes(term))
      );
    });
  }, [records, selectedFund, selectedSubFund, searchTerm]);

  // Dynamic KPI summary based on filtered records
  const dynamicSummary: BudgetSummary = useMemo(() => {
    const totalAmount = filteredRecords.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
    const totalNetPayment = filteredRecords.reduce((acc, cur) => acc + (Number(cur.total) || 0), 0);
    const totalWait = filteredRecords.reduce((acc, cur) => acc + (Number(cur.wait) || 0), 0);
    const totalDebt = filteredRecords.reduce((acc, cur) => acc + (Number(cur.debt) || 0), 0);
    const totalVat = filteredRecords.reduce((acc, cur) => acc + (Number(cur.vat) || 0), 0);
    const totalBond = filteredRecords.reduce((acc, cur) => acc + (Number(cur.bond) || 0), 0);
    const totalOdbt = filteredRecords.reduce((acc, cur) => acc + (Number(cur.odbt) || 0), 0);

    return {
      recordCount: filteredRecords.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalNetPayment: Math.round(totalNetPayment * 100) / 100,
      totalWait: Math.round(totalWait * 100) / 100,
      totalDebt: Math.round(totalDebt * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalBond: Math.round(totalBond * 100) / 100,
      totalOdbt: Math.round(totalOdbt * 100) / 100
    };
  }, [filteredRecords]);

  // Paginated records
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;

  // Sync pageInput whenever currentPage changes
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handlePageJump = (pageStr: string) => {
    const pageNum = parseInt(pageStr, 10);
    if (!isNaN(pageNum)) {
      const validPage = Math.max(1, Math.min(totalPages, pageNum));
      setCurrentPage(validPage);
      setPageInput(String(validPage));
    } else {
      setPageInput(String(currentPage));
    }
  };

  // Chart 1: Comparison by Year (Bar Chart)
  const yearComparisonChartOption = useMemo(() => {
    const yearsList = [...selectedYears].sort();
    
    if (yearsList.length > 1) {
      // Whether comparing all funds or a specific fund/subfund, compare by Year along X-axis
      const yearAmounts = yearsList.map(yr => {
        const sum = records
          .filter(r => {
            const matchesYear = getRecordFiscalYear(r) === yr;
            const matchesFund = selectedFund === 'ALL' || normalizeFundName(r.fundGroupDescr || r.fundName) === selectedFund;
            const matchesSub = selectedSubFund === 'ALL' || (r.efundDesc || r.fundDescr || '').trim() === selectedSubFund;
            return matchesYear && matchesFund && matchesSub;
          })
          .reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
        return Math.round(sum);
      });

      const yearTotals = yearsList.map(yr => {
        const sum = records
          .filter(r => {
            const matchesYear = getRecordFiscalYear(r) === yr;
            const matchesFund = selectedFund === 'ALL' || normalizeFundName(r.fundGroupDescr || r.fundName) === selectedFund;
            const matchesSub = selectedSubFund === 'ALL' || (r.efundDesc || r.fundDescr || '').trim() === selectedSubFund;
            return matchesYear && matchesFund && matchesSub;
          })
          .reduce((acc, cur) => acc + (Number(cur.total) || 0), 0);
        return Math.round(sum);
      });

      return {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: any) => {
            let str = `<b>ปีงบประมาณ ${params[0].name}</b><br/>`;
            params.forEach((p: any) => {
              str += `${p.marker} ${p.seriesName}: ฿${Number(p.value).toLocaleString('th-TH')}<br/>`;
            });
            return str;
          }
        },
        legend: {
          data: ['ยอดจัดสรร (Amount)', 'ยอดโอนสุทธิ (Net Total)'],
          textStyle: { color: '#475569' },
          top: '0%'
        },
        grid: { left: '3%', right: '4%', bottom: '8%', top: '16%', containLabel: true },
        xAxis: {
          type: 'category',
          data: yearsList.map(yr => `ปีงบ ${yr}`),
          axisLine: { lineStyle: { color: '#cbd5e1' } },
          axisLabel: { color: '#475569', fontSize: 12, fontWeight: 500 }
        },
        yAxis: {
          type: 'value',
          axisLine: { lineStyle: { color: '#cbd5e1' } },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
          axisLabel: {
            color: '#64748b',
            formatter: (v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : `${(v/1e3).toFixed(0)}k`
          }
        },
        series: [
          {
            name: 'ยอดจัดสรร (Amount)',
            type: 'bar',
            data: yearAmounts,
            itemStyle: { color: '#059669', borderRadius: [4, 4, 0, 0] }
          },
          {
            name: 'ยอดโอนสุทธิ (Net Total)',
            type: 'bar',
            data: yearTotals,
            itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] }
          }
        ]
      };
    } else {
      // Single Year: Monthly Trend ordered by Fiscal Year (1 Oct - 30 Sep)
      const currentYearNum = parseInt(selectedYears[0] || '2568', 10);
      const prevYearNum = currentYearNum - 1;
      
      // Fixed 12 fiscal months in order: 10/prev, 11/prev, 12/prev, 01/curr ... 09/curr
      const fiscalMonthsOrder = [
        { key: `${prevYearNum}10`, label: `ต.ค. ${String(prevYearNum).slice(-2)}` },
        { key: `${prevYearNum}11`, label: `พ.ย. ${String(prevYearNum).slice(-2)}` },
        { key: `${prevYearNum}12`, label: `ธ.ค. ${String(prevYearNum).slice(-2)}` },
        { key: `${currentYearNum}01`, label: `ม.ค. ${String(currentYearNum).slice(-2)}` },
        { key: `${currentYearNum}02`, label: `ก.พ. ${String(currentYearNum).slice(-2)}` },
        { key: `${currentYearNum}03`, label: `มี.ค. ${String(currentYearNum).slice(-2)}` },
        { key: `${currentYearNum}04`, label: `เม.ย. ${String(currentYearNum).slice(-2)}` },
        { key: `${currentYearNum}05`, label: `พ.ค. ${String(currentYearNum).slice(-2)}` },
        { key: `${currentYearNum}06`, label: `มิ.ย. ${String(currentYearNum).slice(-2)}` },
        { key: `${currentYearNum}07`, label: `ก.ค. ${String(currentYearNum).slice(-2)}` },
        { key: `${currentYearNum}08`, label: `ส.ค. ${String(currentYearNum).slice(-2)}` },
        { key: `${currentYearNum}09`, label: `ก.ย. ${String(currentYearNum).slice(-2)}` },
      ];

      const monthMap: { [key: string]: { amount: number; net: number; label: string } } = {};
      fiscalMonthsOrder.forEach(fm => {
        monthMap[fm.key] = { amount: 0, net: 0, label: fm.label };
      });

      filteredRecords.forEach(r => {
        const dateStr = String(r.postingDate || '');
        if (dateStr.length >= 6) {
          const key = dateStr.substring(0, 6);
          if (!monthMap[key]) {
            const y = key.substring(0, 4);
            const m = key.substring(4, 6);
            const thM = thaiMonthNames[m] || m;
            monthMap[key] = { amount: 0, net: 0, label: `${thM} ${y.slice(-2)}` };
          }
          monthMap[key].amount += Number(r.amount) || 0;
          monthMap[key].net += Number(r.total) || 0;
        }
      });

      // Filter to months that exist in the fiscal cycle or have data
      const activeMonthKeys = fiscalMonthsOrder
        .map(fm => fm.key)
        .concat(Object.keys(monthMap).filter(k => !fiscalMonthsOrder.some(fm => fm.key === k)));
      
      const distinctActiveKeys = Array.from(new Set(activeMonthKeys));

      return {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: {
          data: ['ยอดจัดสรร (Amount)', 'ยอดโอนสุทธิ (Net Total)'],
          textStyle: { color: '#475569' },
          top: '0%'
        },
        grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
        xAxis: {
          type: 'category',
          data: distinctActiveKeys.map(k => monthMap[k]?.label || k),
          axisLine: { lineStyle: { color: '#cbd5e1' } },
          axisLabel: { color: '#475569', fontSize: 11 }
        },
        yAxis: {
          type: 'value',
          axisLine: { lineStyle: { color: '#cbd5e1' } },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
          axisLabel: {
            color: '#64748b',
            formatter: (v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : `${(v/1e3).toFixed(0)}k`
          }
        },
        series: [
          {
            name: 'ยอดจัดสรร (Amount)',
            type: 'bar',
            data: distinctActiveKeys.map(k => Math.round(monthMap[k]?.amount || 0)),
            itemStyle: { color: '#059669', borderRadius: [4, 4, 0, 0] }
          },
          {
            name: 'ยอดโอนสุทธิ (Net Total)',
            type: 'line',
            smooth: true,
            data: distinctActiveKeys.map(k => Math.round(monthMap[k]?.net || 0)),
            itemStyle: { color: '#10b981' },
            lineStyle: { width: 3 }
          }
        ]
      };
    }
  }, [selectedYears, selectedFund, selectedSubFund, records, availableFunds, filteredRecords]);

  // Chart 2: Budget Breakdown (Donut)
  // When a specific fund is selected, drill down by subfund (efundDesc) or by Year!
  const fundGroupChartOption = useMemo(() => {
    const groupMap: { [key: string]: number } = {};
    
    if (selectedSubFund !== 'ALL') {
      // Subfund selected: show breakdown by year (if multi-year) or single slice
      if (selectedYears.length > 1) {
        filteredRecords.forEach(r => {
          const yrName = `ปีงบ ${getRecordFiscalYear(r)}`;
          groupMap[yrName] = (groupMap[yrName] || 0) + (Number(r.amount) || 0);
        });
      } else {
        filteredRecords.forEach(r => {
          const name = r.refDocNo || r.batchNo || selectedSubFund;
          groupMap[name] = (groupMap[name] || 0) + (Number(r.amount) || 0);
        });
      }
    } else if (selectedFund !== 'ALL') {
      // If multi-year is active, breakdown by Year!
      if (selectedYears.length > 1) {
        filteredRecords.forEach(r => {
          const yrName = `ปีงบ ${getRecordFiscalYear(r)}`;
          groupMap[yrName] = (groupMap[yrName] || 0) + (Number(r.amount) || 0);
        });
      } else {
        // Single year: breakdown by sub-fund (กองทุนย่อยเฉพาะด้าน)
        filteredRecords.forEach(r => {
          const subName = r.efundDesc || r.fundDescr || 'กองทุนย่อยทั่วไป';
          groupMap[subName] = (groupMap[subName] || 0) + (Number(r.amount) || 0);
        });
      }
    } else {
      // All funds: breakdown by fund name
      filteredRecords.forEach(r => {
        const name = r.fundGroupDescr || r.fundName || 'อื่นๆ';
        groupMap[name] = (groupMap[name] || 0) + (Number(r.amount) || 0);
      });
    }

    const data = Object.entries(groupMap)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          return `<b>${params.name}</b><br/>ยอดจัดสรร: ฿${params.value.toLocaleString('th-TH')} (${params.percent}%)`;
        }
      },
      legend: {
        orient: 'vertical',
        right: '2%',
        top: 'middle',
        textStyle: { color: '#475569', fontSize: 11 },
        type: 'scroll'
      },
      series: [
        {
          name: selectedSubFund !== 'ALL' 
            ? 'สัดส่วนตามปีงบประมาณ' 
            : (selectedFund !== 'ALL' ? (selectedYears.length > 1 ? 'สัดส่วนตามปีงบประมาณ' : 'สัดส่วนกองทุนย่อย') : 'หมวดงบประมาณ'),
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 6, borderColor: '#ffffff', borderWidth: 2 },
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#0f172a' }
          },
          data
        }
      ]
    };
  }, [filteredRecords, selectedFund, selectedSubFund, selectedYears]);

  // Export Excel
  const exportToExcel = () => {
    if (filteredRecords.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(filteredRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SMT_Budget');
    XLSX.writeFile(workbook, `NHSO_Budget_${selectedYears.join('_')}_Vendor_${vendorId5Digit || 'All'}.xlsx`);
  };

  return (
    <div className="dashboard-container">
      {/* Top Header */}
      <header className="header-bar">
        <div className="header-title-box">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge-nhso">NHSO SMT</span>
              <h1 style={{ fontSize: '20px', fontWeight: 600 }}>ระบบติดตามและวิเคราะห์งบประมาณ สปสช.</h1>
            </div>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
              Smart Monitoring & Tracking Analytical Dashboard (รองรับการเปรียบเทียบข้ามปีงบประมาณ)
            </p>
          </div>
        </div>

        <div className="header-status">
          {lastUpdated && (
            <span className="status-indicator status-online">
              <span className="pulse-dot"></span>
              อัปเดตล่าสุด: {lastUpdated} {dataSource === 'cache' ? '(แคช)' : '(สด)'}
            </span>
          )}
          <button 
            className="btn btn-secondary" 
            onClick={() => fetchData(true)}
            disabled={loading}
            title="ดึงข้อมูลใหม่โดยตรงจาก สปสช."
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            รีเฟรชข้อมูล
          </button>
        </div>
      </header>

      {/* Control Panel (Multi-Year & Global Filters) */}
      <section className="control-panel">
        <div className="filter-grid">
          {/* Multi-Year Selection Chips */}
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} color="#38bdf8" />
              <span>เลือกปีงบประมาณ พ.ศ. (คลิกเลือกได้หลายปีเพื่อเปรียบเทียบ)</span>
            </label>
            <div className="year-btn-group">
              {AVAILABLE_YEARS.map(yr => {
                const isActive = selectedYears.includes(yr);
                return (
                  <button
                    key={yr}
                    type="button"
                    className={`year-chip ${isActive ? 'active' : ''}`}
                    onClick={() => handleToggleYear(yr)}
                  >
                    {isActive ? `✓ ปีงบ ${yr}` : `ปีงบ ${yr}`}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">รหัสหน่วยบริการ 5 หลัก</label>
            <input 
              type="text" 
              className="form-input"
              value={vendorId5Digit} 
              onChange={(e) => setVendorId5Digit(e.target.value)}
              placeholder="เช่น 11152 (ว่าง=ทั้งหมด)"
            />
          </div>

          <div className="form-group">
            <label className="form-label">เขตพื้นที่ สปสช. (Zone)</label>
            <select 
              className="form-select"
              value={zoneId} 
              onChange={(e) => setZoneId(e.target.value)}
            >
              <option value="">ทุกเขต (ทั้งหมด)</option>
              {Array.from({ length: 13 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>เขต {i + 1}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">ระบบ Auto-Refresh</label>
            <select 
              className="form-select"
              value={autoRefreshInterval} 
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
            >
              <option value={0}>ปิด (Manual)</option>
              <option value={300}>ทุกๆ 5 นาที</option>
              <option value={900}>ทุกๆ 15 นาที</option>
              <option value={1800}>ทุกๆ 30 นาที</option>
            </select>
          </div>
        </div>

        <div className="actions-row">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => fetchData(false)}
              disabled={loading}
            >
              <Filter size={15} />
              ดึงข้อมูลงบประมาณ ({selectedYears.map(y => `ปีงบ ${y}`).join(', ')})
            </button>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              * เลือกได้หลายปีพร้อมกัน ระบบจะดึงและนำมารวม/เปรียบเทียบให้อัตโนมัติ
            </span>
          </div>

          <div>
            <button 
              className="btn btn-success" 
              onClick={exportToExcel}
              disabled={filteredRecords.length === 0}
            >
              <FileSpreadsheet size={15} />
              ส่งออก Excel (.xlsx)
            </button>
          </div>
        </div>
      </section>

      {/* Error Message */}
      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '14px', borderRadius: '8px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <section className="kpi-grid">
        <div className="kpi-card" style={{ '--card-accent': '#0284c7' } as any}>
          <div className="kpi-header">
            <span>วงเงินจัดสรรรวม (Amount)</span>
            <DollarSign size={18} color="#38bdf8" />
          </div>
          <div className="kpi-value">฿{formatCurrency(dynamicSummary.totalAmount)}</div>
          <div className="kpi-sub">จากทั้งหมด {dynamicSummary.recordCount.toLocaleString('th-TH')} รายการโอน</div>
        </div>

        <div className="kpi-card" style={{ '--card-accent': '#10b981' } as any}>
          <div className="kpi-header">
            <span>ยอดโอนชดเชยสุทธิ (Net Total)</span>
            <TrendingUp size={18} color="#34d399" />
          </div>
          <div className="kpi-value">฿{formatCurrency(dynamicSummary.totalNetPayment)}</div>
          <div className="kpi-sub">โอนเข้าบัญชีหน่วยบริการสำเร็จ</div>
        </div>

        <div className="kpi-card" style={{ '--card-accent': '#f59e0b' } as any}>
          <div className="kpi-header">
            <span>ยอดเงินรอดำเนินการ (Wait)</span>
            <Clock size={18} color="#fbbf24" />
          </div>
          <div className="kpi-value">฿{formatCurrency(dynamicSummary.totalWait)}</div>
          <div className="kpi-sub">อยู่ระหว่างกระบวนการตรวจสอบ/สั่งจ่าย</div>
        </div>

        <div className="kpi-card" style={{ '--card-accent': '#ef4444' } as any}>
          <div className="kpi-header">
            <span>ยอดหนี้สิน/หักชำระ (Debt & Vat)</span>
            <AlertCircle size={18} color="#f87171" />
          </div>
          <div className="kpi-value">฿{formatCurrency((dynamicSummary.totalDebt || 0) + (dynamicSummary.totalVat || 0))}</div>
          <div className="kpi-sub">หักหนี้ ฿{formatCurrency(dynamicSummary.totalDebt)} | VAT ฿{formatCurrency(dynamicSummary.totalVat)}</div>
        </div>
      </section>

      {/* Charts Grid */}
      <section className="charts-grid">
        <div className="chart-card">
          <div className="card-title">
            <BarChart3 size={18} color="#38bdf8" />
            {selectedYears.length > 1 
              ? (selectedSubFund !== 'ALL'
                  ? `เปรียบเทียบกองทุนย่อย "${selectedSubFund}" (${selectedYears.map(y => `ปีงบ ${y}`).join(' vs ')})`
                  : (selectedFund !== 'ALL'
                      ? `เปรียบเทียบ ${selectedFund} (${selectedYears.map(y => `ปีงบ ${y}`).join(' vs ')})`
                      : `เปรียบเทียบงบประมาณรวมทุกกองทุน (${selectedYears.map(y => `ปีงบ ${y}`).join(' vs ')})`
                    )
                )
              : `แนวโน้มการโอนงบประมาณรายเดือน (ปีงบประมาณ ${selectedYears[0]})`
            }
          </div>
          <div style={{ height: '320px' }}>
            <ReactECharts option={yearComparisonChartOption} notMerge={true} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

        <div className="chart-card">
          <div className="card-title">
            <PieIcon size={18} color="#a78bfa" />
            {selectedSubFund !== 'ALL'
              ? `สัดส่วนงบประมาณ ${selectedSubFund} แยกตามปีงบประมาณ`
              : (selectedFund !== 'ALL'
                  ? (selectedYears.length > 1
                      ? `สัดส่วนงบประมาณ ${selectedFund} แยกตามปีงบประมาณ`
                      : `สัดส่วนกองทุนย่อยของ ${selectedFund}`
                    )
                  : 'สัดส่วนงบประมาณตามกลุ่มกองทุน (Budget Breakdown)'
                )
            }
          </div>
          <div style={{ height: '320px' }}>
            <ReactECharts option={fundGroupChartOption} notMerge={true} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </section>

      {/* Data Table */}
      <section className="table-card">
        <div className="table-controls">
          <div className="card-title">
            <span>รายการธุรกรรมงบประมาณ ({filteredRecords.length.toLocaleString('th-TH')} รายการ)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            {/* Filter by Fund Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={15} color="#059669" />
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>กองทุน:</label>
              <select 
                className="form-select"
                style={{ width: '210px', padding: '7px 10px' }}
                value={selectedFund}
                onChange={(e) => {
                  setSelectedFund(e.target.value);
                  setSelectedSubFund('ALL');
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">ทุกกองทุน (ทั้งหมด)</option>
                {availableFunds.map((fund, idx) => (
                  <option key={idx} value={fund}>{fund}</option>
                ))}
              </select>
            </div>

            {/* Filter by SubFund Dropdown (กองทุนย่อยเฉพาะด้าน) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GitFork size={15} color="#10b981" />
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>กองทุนย่อยเฉพาะด้าน:</label>
              <select 
                className="form-select"
                style={{ width: '240px', padding: '7px 10px' }}
                value={selectedSubFund}
                onChange={(e) => {
                  setSelectedSubFund(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">ทุกกองทุนย่อย (ทั้งหมด)</option>
                {availableSubFunds.map((sub, idx) => (
                  <option key={idx} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {/* Keyword Search */}
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                className="form-input"
                style={{ paddingLeft: '32px', width: '210px', padding: '7px 12px 7px 32px' }}
                placeholder="ค้นหาเลขเอกสาร, งวด..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: '#64748b' }} />
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>ลำดับ</th>
                {selectedYears.length > 1 && <th style={{ textAlign: 'center' }}>ปี พ.ศ.</th>}
                <th>วันที่โอน</th>
                <th>
                  <div className="th-2lines">
                    <span>งวด/</span>
                    <span>เลขที่เบิกจ่าย</span>
                  </div>
                </th>
                <th>
                  <div className="th-2lines">
                    <span>รหัสผังบัญชี</span>
                    <span>สป.สธ.</span>
                  </div>
                </th>
                <th>กองทุน</th>
                <th>
                  <div className="th-2lines">
                    <span>กองทุนย่อย</span>
                    <span>เฉพาะด้าน</span>
                  </div>
                </th>
                <th style={{ textAlign: 'right' }}>จำนวนเงิน</th>
                <th style={{ textAlign: 'right' }}>ชะลอการโอน</th>
                <th style={{ textAlign: 'right' }}>รายการหักจากยอดโอนเงิน</th>
                <th style={{ textAlign: 'right' }}>
                  <div className="th-2lines" style={{ alignItems: 'flex-end' }}>
                    <span>หลักประกัน</span>
                    <span>สัญญา</span>
                  </div>
                </th>
                <th style={{ textAlign: 'right' }}>
                  <div className="th-2lines" style={{ alignItems: 'flex-end' }}>
                    <span>ภาษีหัก</span>
                    <span>ณ ที่จ่าย</span>
                  </div>
                </th>
                <th style={{ textAlign: 'right' }}>
                  <div className="th-2lines" style={{ alignItems: 'flex-end' }}>
                    <span>คงเหลือ</span>
                    <span>เงินที่จ่าย</span>
                  </div>
                </th>
                <th style={{ textAlign: 'right' }}>
                  <div className="th-2lines" style={{ alignItems: 'flex-end' }}>
                    <span>จำนวนเงิน</span>
                    <span>รอหักกลบ</span>
                  </div>
                </th>
                <th style={{ textAlign: 'center' }}>
                  <div className="th-2lines" style={{ alignItems: 'center' }}>
                    <span>Download</span>
                    <span>เอกสาร</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={selectedYears.length > 1 ? 15 : 14} style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontWeight: 500 }}>
                    กำลังโหลดข้อมูลจากระบบ สปสช...
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={selectedYears.length > 1 ? 15 : 14} style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontWeight: 500 }}>
                    ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, idx) => {
                  const downloadUrl = r.downloadPAYMFileName 
                    ? `https://smt.nhso.go.th/smtf/api/budgetreport/budgetSummaryByVendorReportDetail/download?fileName=${r.downloadPAYMFileName}`
                    : (r.downloadUrl || null);

                  return (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{(currentPage - 1) * pageSize + idx + 1}</td>
                      {selectedYears.length > 1 && (
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge-tag" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                            {r.fiscalYear || '-'}
                          </span>
                        </td>
                      )}
                      <td style={{ color: '#334155', fontWeight: 500 }}>
                        {r.runDt 
                          ? new Date(r.runDt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
                          : (r.cpostingDate || r.postingDate || '-')}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.refDocNo || '-'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>งวด: {r.batchNo || '-'}</div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>{r.mophId || '-'}</span>
                      </td>
                      <td className="cell-wrap col-fund">
                        <span className="badge-tag" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', lineHeight: 1.4, padding: '4px 8px' }}>
                          {r.fundGroupDescr || r.fundName || '-'}
                        </span>
                      </td>
                      <td className="cell-wrap col-subfund">
                        {r.efundDesc || r.fundDescr || '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0369a1' }}>
                        {formatCurrency(r.amount)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: Number(r.wait) > 0 ? '#b45309' : '#94a3b8' }}>
                        {formatCurrency(r.wait)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: Number(r.debt) > 0 ? '#b91c1c' : '#94a3b8' }}>
                        {formatCurrency(r.debt)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: Number(r.bond) > 0 ? '#b45309' : '#94a3b8' }}>
                        {formatCurrency(r.bond)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: Number(r.vat) > 0 ? '#b91c1c' : '#94a3b8' }}>
                        {formatCurrency(r.vat)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                        {formatCurrency(r.total)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: Number(r.odbt) > 0 ? '#c2410c' : '#94a3b8' }}>
                        {formatCurrency(r.odbt)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {downloadUrl ? (
                          <a 
                            href={downloadUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            style={{ 
                              color: '#047857', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px', 
                              textDecoration: 'none',
                              background: '#ecfdf5',
                              border: '1px solid #a7f3d0',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600
                            }}
                          >
                            <ExternalLink size={12} />
                            ดาวน์โหลด
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer Summary following SMT layout */}
            {filteredRecords.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 'bold', borderTop: '2px solid #cbd5e1' }}>
                  <td colSpan={selectedYears.length > 1 ? 7 : 6} style={{ textAlign: 'center', color: '#0f172a', fontSize: '13px', fontWeight: 700 }}>
                    รวมทั้งสิ้น ({filteredRecords.length.toLocaleString('th-TH')} รายการ)
                  </td>
                  <td style={{ textAlign: 'right', color: '#0369a1', fontWeight: 800 }}>
                    {formatCurrency(dynamicSummary.totalAmount)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#b45309', fontWeight: 700 }}>
                    {formatCurrency(dynamicSummary.totalWait)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#b91c1c', fontWeight: 700 }}>
                    {formatCurrency(dynamicSummary.totalDebt)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#b45309', fontWeight: 700 }}>
                    {formatCurrency(dynamicSummary.totalBond)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#b91c1c', fontWeight: 700 }}>
                    {formatCurrency(dynamicSummary.totalVat)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#047857', fontWeight: 800 }}>
                    {formatCurrency(dynamicSummary.totalNetPayment)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#c2410c', fontWeight: 700 }}>
                    {formatCurrency(dynamicSummary.totalOdbt)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="pagination">
          <div>
            แสดง {filteredRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} ถึง {Math.min(currentPage * pageSize, filteredRecords.length)} จาก {filteredRecords.length.toLocaleString('th-TH')} รายการ
          </div>
          <div className="page-buttons">
            <button 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px' }}
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} />
              ก่อนหน้า
            </button>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '0 6px', fontSize: '13px', color: '#334155' }}>
              <span style={{ fontWeight: 600 }}>หน้า</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePageJump(pageInput);
                  }
                }}
                onBlur={() => handlePageJump(pageInput)}
                style={{
                  width: '56px',
                  textAlign: 'center',
                  padding: '5px 4px',
                  borderRadius: '6px',
                  border: '1.5px solid #10b981',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 700,
                  fontSize: '13px',
                  outline: 'none',
                  boxShadow: '0 1px 2px rgba(16, 185, 129, 0.1)'
                }}
                title="กด Enter หรือคลิกข้างนอกเพื่อเปลี่ยนหน้า"
              />
              <span style={{ color: '#64748b', fontWeight: 500 }}>/ {totalPages}</span>
            </div>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px' }}
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              ถัดไป
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
