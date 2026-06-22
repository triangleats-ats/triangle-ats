import React, { useState, useEffect, useCallback } from 'react';

// ── Column definitions (matches spreadsheet columns A→AX, 50 cols) ──
const COLUMNS = [
  'FADV Case ID','Name','Phone','Email','Location','FedEx ID','Recruiter','Source',
  'Route / Position','Shift','CPM','Sign in Bonus','Current Phase','Pipeline Status','Msg Answered',
  'CDL Class','Experience','Doubles & Triples','FADV Link Sent','FADV Completed',
  'FADV Status','Background Review','Criminal Review','MVR Review','Drug Test Sent',
  'Drug Test Result','DocuSign Sent','DocuSign Signed','Clearinghouse Consent',
  'Clearinghouse Result','Employment Verification','DQ File Complete','AC3',
  'I-9 Complete','SIG / FedEx ID Activated','English Assessment','Orientation',
  'Final Approval','Date Entered Phase','Last Update','Days in Phase','Follow-up Due',
  'Follow-up Sent','48h Alert','Auto Flags','Hire Date','Start Date',
  'Assigned Terminal','Assigned Manager','Notes'
];

const COL = Object.fromEntries(COLUMNS.map((c, i) => [c, i]));
const TOTAL_COLS = COLUMNS.length; // 50

const PHASES = [
  'Phase 1 - Initial Contact','Phase 2 - Pre-Screening','Phase 3 - First Advantage',
  'Phase 4 - Drug Test','Phase 5 - DocuSign','Phase 6 - Clearinghouse',
  'Phase 7 - Employment Verification','Phase 8 - DQ File Review','Phase 9 - I-9 / Workforce',
  'Phase 10 - SIG / FedEx ID','Phase 11 - English Assessment','Phase 12 - Orientation',
  'Phase 13 - Final Approval','Phase 14 - Onboarding'
];

const PIPELINE_STATUSES = [
  'Sent message','Sent message - Indeed','Call','Will think','FADV (First Advantage)',
  'Drug test / Docusign','Docusign','Drug test','Drug test results','Employment verification',
  'MEC','Orientation scheduled','I9 / SIG','English test','Under review','Wait on transfer',
  'ROAD TEST / SKILLSOFT','GCIC','Hired','Gave 24hs notice','FADV Expired','FADV DUPLICATED',
  'No Doubles&Triples','SAP DRIVER','No experience','Declined - Not interested',
  'Declined - No response','Declined - Failed drug test','Declined - Failed background check'
];

const RECRUITERS = ['Bianka','Carol','Catarina','Margarita'];
const SOURCES = ['Indeed','Referral','Walk-in','Website','Call','Other','Transfer'];
const ROUTES = [
  'ORL - 328','ORL - 327','MARIETTA - 305','ORL DRIVING TX','TX DOMICILED - DRIVING FL',
  'MARIETTA - DRIVING TX','OCALA - 344','HOUSTON 774 TX','FORT WORTH 760 TX','SANFORD - 347',
  'DALL 753 TX','TEXAS - (753-760-774)','ORL LOCAL','HOUSTON 754 TX'
];
const SHIFTS = ['OTR (48 states)','Local','Overnight','Day'];
const YES_NO = ['Yes','No',''];
const COMPLIANCE_VALS = ['Pending','Complete','Issue','N/A',''];
const DRUG_RESULTS = ['Pending','Negative','Positive',''];
const MSG_ANSWERED = ['Yes','No','Read','Call',''];

// CPM options — OTR rates per mile + Local daily rate
const CPM_OPTIONS = ['$0.37','$0.40','$0.42','$0.45','$200'];

const ACTIVE_STATUSES = new Set([
  'Sent message','Sent message - Indeed','Call','Will think','FADV (First Advantage)',
  'Drug test / Docusign','Docusign','Drug test','Drug test results','Employment verification',
  'MEC','Orientation scheduled','I9 / SIG','English test','Under review','Wait on transfer',
  'ROAD TEST / SKILLSOFT','GCIC','Gave 24hs notice'
]);

const DECLINED_STATUSES = new Set([
  'Declined - Not interested','Declined - No response','Declined - Failed drug test',
  'Declined - Failed background check','FADV Expired','FADV DUPLICATED','No Doubles&Triples',
  'SAP DRIVER','No experience'
]);

// ── API helpers ──
async function fetchCandidates() {
  const res = await fetch('/api/candidates');
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const { rows } = await res.json();
  return rows.map(row => {
    const padded = [...row];
    while (padded.length < TOTAL_COLS) padded.push('');
    return padded;
  });
}

async function updateCandidate(rowIndex, rowData) {
  const res = await fetch('/api/candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', rowIndex, rowData }),
  });
  if (!res.ok) throw new Error(`Update error: ${res.status}`);
}

async function appendCandidate(rowData) {
  const res = await fetch('/api/candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'append', newRow: rowData }),
  });
  if (!res.ok) throw new Error(`Append error: ${res.status}`);
}

// ── Utilities ──
function today() {
  return new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

function daysInPhase(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function isOverdue(row) {
  const status = row[COL['Pipeline Status']] || '';
  if (!ACTIVE_STATUSES.has(status)) return false;
  const days = daysInPhase(row[COL['Date Entered Phase']]);
  return typeof days === 'number' && days > 2;
}

function getAutoFlags(row) {
  const flags = [];
  const exp = (row[COL['Experience']] || '').toLowerCase();
  const dt = row[COL['Doubles & Triples']] || '';
  const fadv = row[COL['FADV Status']] || '';
  const drugResult = row[COL['Drug Test Result']] || '';
  const bgReview = row[COL['Background Review']] || '';
  const crimReview = row[COL['Criminal Review']] || '';
  const mvrReview = row[COL['MVR Review']] || '';
  const empVer = row[COL['Employment Verification']] || '';
  const notes = (row[COL['Notes']] || '').toLowerCase();

  if (exp.includes('month') && parseInt(exp) < 6) flags.push('Exp < 6 months');
  if (dt === 'No') flags.push('No Doubles & Triples');
  if (fadv === 'Issue') flags.push('FADV - re-run / ineligible');
  if (drugResult === 'Positive') flags.push('Drug test POSITIVE');
  if (bgReview === 'Issue' || crimReview === 'Issue') flags.push('Background check FAIL');
  if (mvrReview === 'Issue' || notes.includes('mvr')) flags.push('MVR concern');
  if (empVer === 'Issue') flags.push('Employment verification concern');
  return flags.join(' | ');
}

// ── Styles ──
const S = {
  app: { minHeight: '100vh', background: '#f0f2f5' },
  header: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    color: '#fff', padding: '16px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
  },
  headerTitle: { fontSize: 20, fontWeight: 700, letterSpacing: 0.5 },
  headerSub: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  statsRow: {
    display: 'flex', gap: 12, padding: '16px 24px', flexWrap: 'wrap'
  },
  stat: {
    background: '#fff', borderRadius: 10, padding: '12px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', minWidth: 110, textAlign: 'center'
  },
  statNum: { fontSize: 26, fontWeight: 700, color: '#1a1a2e' },
  statLabel: { fontSize: 11, color: '#666', marginTop: 2 },
  toolbar: {
    display: 'flex', gap: 10, padding: '0 24px 16px', flexWrap: 'wrap', alignItems: 'center'
  },
  input: {
    padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd',
    fontSize: 13, outline: 'none', background: '#fff'
  },
  select: {
    padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd',
    fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer'
  },
  btn: (color='#1a1a2e') => ({
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: color, color: '#fff', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap'
  }),
  tableWrap: { padding: '0 24px 24px', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  th: {
    background: '#1a1a2e', color: '#fff', padding: '10px 12px',
    textAlign: 'left', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
  },
  td: { padding: '9px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 13, verticalAlign: 'middle' },
  badge: (color) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 12,
    fontSize: 11, fontWeight: 600, background: color + '20', color: color, whiteSpace: 'nowrap'
  }),
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
  },
  modalBox: {
    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720,
    maxHeight: '90vh', overflow: 'auto', padding: 28
  },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#1a1a2e' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 12, fontWeight: 600, color: '#555' },
  fieldInput: {
    padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd',
    fontSize: 13, outline: 'none', width: '100%'
  },
  fieldSelect: {
    padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd',
    fontSize: 13, outline: 'none', width: '100%', background: '#fff'
  },
  alert: { background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#856404', marginBottom: 12 },
  saving: { position: 'fixed', bottom: 20, right: 20, background: '#1a1a2e', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, zIndex: 2000 }
};

function phaseColor(phase) {
  if (!phase) return '#999';
  const n = parseInt(phase.match(/\d+/)?.[0] || '0');
  if (n <= 2) return '#6c757d';
  if (n <= 5) return '#0d6efd';
  if (n <= 8) return '#fd7e14';
  if (n <= 11) return '#6610f2';
  if (n === 14) return '#198754';
  return '#20c997';
}

function statusColor(status) {
  if (!status) return '#999';
  if (status === 'Hired') return '#198754';
  if (status.startsWith('Declined')) return '#dc3545';
  if (status === 'FADV Expired' || status === 'FADV DUPLICATED') return '#dc3545';
  if (status === 'No Doubles&Triples' || status === 'No experience') return '#ffc107';
  if (status === 'SAP DRIVER') return '#6610f2';
  return '#0d6efd';
}

// ── Field component ──
function Field({ label, value, onChange, type='text', options=null, fullWidth=false, hint=null }) {
  const style = fullWidth ? { ...S.field, gridColumn: '1 / -1' } : S.field;
  return (
    <div style={style}>
      <label style={S.label}>{label}</label>
      {options ? (
        <select style={S.fieldSelect} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea style={{ ...S.fieldInput, minHeight: 70, resize: 'vertical' }} value={value} onChange={e => onChange(e.target.value)} />
      ) : (
        <input style={S.fieldInput} type={type} value={value} onChange={e => onChange(e.target.value)} />
      )}
      {hint && <span style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{hint}</span>}
    </div>
  );
}

// ── Candidate Modal ──
function CandidateModal({ candidate, rowIndex, onClose, onSave, isNew }) {
  const [row, setRow] = useState(() => {
    if (candidate) return [...candidate];
    const r = new Array(TOTAL_COLS).fill('');
    r[COL['Date Entered Phase']] = today();
    r[COL['Last Update']] = today();
    r[COL['CDL Class']] = 'A';
    return r;
  });
  const [saving, setSaving] = useState(false);

  const set = (col, val) => setRow(r => { const n = [...r]; n[col] = val; return n; });

  // Auto-suggest CPM based on Shift
  const handleShiftChange = (newShift) => {
    set(COL['Shift'], newShift);
    // Suggest CPM defaults if empty
    const currentCPM = row[COL['CPM']];
    if (!currentCPM) {
      if (newShift === 'Local') set(COL['CPM'], '$200');
      else if (newShift === 'OTR (48 states)') set(COL['CPM'], '$0.45');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    // Auto-update computed fields
    const updated = [...row];
    updated[COL['Last Update']] = today();
    updated[COL['Days in Phase']] = String(daysInPhase(updated[COL['Date Entered Phase']]) || '');
    updated[COL['48h Alert']] = isOverdue(updated) ? '⚠ OVERDUE 48h' : '';
    updated[COL['Auto Flags']] = getAutoFlags(updated);
    try {
      await onSave(rowIndex, updated, isNew);
      onClose();
    } catch (e) {
      alert('Error saving: ' + e.message);
    }
    setSaving(false);
  };

  const v = (col) => row[col] || '';
  const shift = v(COL['Shift']);
  const cpmHint = shift === 'Local' ? '$ per day (Local = $200/day)' :
                  shift === 'OTR (48 states)' ? '$ per mile (split miles)' : '';

  return (
    <div style={S.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modalBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={S.modalTitle}>{isNew ? '➕ New Candidate' : `✏️ ${v(COL['Name']) || 'Edit Candidate'}`}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#666' }}>✕</button>
        </div>

        {/* Flags warning */}
        {!isNew && getAutoFlags(row) && (
          <div style={S.alert}>⚠️ {getAutoFlags(row)}</div>
        )}

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>📋 Candidate Info</div>
          <div style={S.grid}>
            <Field label="FADV Case ID" value={v(COL['FADV Case ID'])} onChange={val => set(COL['FADV Case ID'], val)} />
            <Field label="FedEx ID" value={v(COL['FedEx ID'])} onChange={val => set(COL['FedEx ID'], val)} />
            <Field label="Name *" value={v(COL['Name'])} onChange={val => set(COL['Name'], val)} />
            <Field label="Phone" value={v(COL['Phone'])} onChange={val => set(COL['Phone'], val)} />
            <Field label="Email" value={v(COL['Email'])} onChange={val => set(COL['Email'], val)} />
            <Field label="Location" value={v(COL['Location'])} onChange={val => set(COL['Location'], val)} />
            <Field label="Recruiter" value={v(COL['Recruiter'])} onChange={val => set(COL['Recruiter'], val)} options={RECRUITERS} />
            <Field label="Source" value={v(COL['Source'])} onChange={val => set(COL['Source'], val)} options={SOURCES} />
            <Field label="Route / Position" value={v(COL['Route / Position'])} onChange={val => set(COL['Route / Position'], val)} options={ROUTES} />
            <Field label="Shift" value={v(COL['Shift'])} onChange={handleShiftChange} options={SHIFTS} />
            <Field label="CPM / Pay Rate" value={v(COL['CPM'])} onChange={val => set(COL['CPM'], val)} options={CPM_OPTIONS} hint={cpmHint} />
            <Field label="Sign in Bonus ($1,000 after 90d)" value={v(COL['Sign in Bonus'])} onChange={val => set(COL['Sign in Bonus'], val)} options={YES_NO} />
            <Field label="Msg Answered" value={v(COL['Msg Answered'])} onChange={val => set(COL['Msg Answered'], val)} options={MSG_ANSWERED} />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>📊 Pipeline</div>
          <div style={S.grid}>
            <Field label="Current Phase" value={v(COL['Current Phase'])} onChange={val => { set(COL['Current Phase'], val); set(COL['Date Entered Phase'], today()); }} options={PHASES} />
            <Field label="Pipeline Status" value={v(COL['Pipeline Status'])} onChange={val => set(COL['Pipeline Status'], val)} options={PIPELINE_STATUSES} />
            <Field label="Date Entered Phase" value={v(COL['Date Entered Phase'])} onChange={val => set(COL['Date Entered Phase'], val)} type="date" />
            <Field label="Last Update" value={v(COL['Last Update'])} onChange={val => set(COL['Last Update'], val)} />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>✅ Qualifications</div>
          <div style={S.grid}>
            <Field label="CDL Class" value={v(COL['CDL Class'])} onChange={val => set(COL['CDL Class'], val)} options={['A','B','C','']} />
            <Field label="Experience" value={v(COL['Experience'])} onChange={val => set(COL['Experience'], val)} />
            <Field label="Doubles & Triples" value={v(COL['Doubles & Triples'])} onChange={val => set(COL['Doubles & Triples'], val)} options={YES_NO} />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>🔍 Compliance</div>
          <div style={S.grid}>
            <Field label="FADV Link Sent" value={v(COL['FADV Link Sent'])} onChange={val => set(COL['FADV Link Sent'], val)} options={YES_NO} />
            <Field label="FADV Completed" value={v(COL['FADV Completed'])} onChange={val => set(COL['FADV Completed'], val)} options={COMPLIANCE_VALS} />
            <Field label="FADV Status" value={v(COL['FADV Status'])} onChange={val => set(COL['FADV Status'], val)} options={COMPLIANCE_VALS} />
            <Field label="Background Review" value={v(COL['Background Review'])} onChange={val => set(COL['Background Review'], val)} options={COMPLIANCE_VALS} />
            <Field label="Criminal Review" value={v(COL['Criminal Review'])} onChange={val => set(COL['Criminal Review'], val)} options={COMPLIANCE_VALS} />
            <Field label="MVR Review" value={v(COL['MVR Review'])} onChange={val => set(COL['MVR Review'], val)} options={COMPLIANCE_VALS} />
            <Field label="Drug Test Sent" value={v(COL['Drug Test Sent'])} onChange={val => set(COL['Drug Test Sent'], val)} options={YES_NO} />
            <Field label="Drug Test Result" value={v(COL['Drug Test Result'])} onChange={val => set(COL['Drug Test Result'], val)} options={DRUG_RESULTS} />
            <Field label="DocuSign Sent" value={v(COL['DocuSign Sent'])} onChange={val => set(COL['DocuSign Sent'], val)} options={YES_NO} />
            <Field label="DocuSign Signed" value={v(COL['DocuSign Signed'])} onChange={val => set(COL['DocuSign Signed'], val)} options={YES_NO} />
            <Field label="Clearinghouse Consent" value={v(COL['Clearinghouse Consent'])} onChange={val => set(COL['Clearinghouse Consent'], val)} options={YES_NO} />
            <Field label="Clearinghouse Result" value={v(COL['Clearinghouse Result'])} onChange={val => set(COL['Clearinghouse Result'], val)} options={COMPLIANCE_VALS} />
            <Field label="Employment Verification" value={v(COL['Employment Verification'])} onChange={val => set(COL['Employment Verification'], val)} options={COMPLIANCE_VALS} />
            <Field label="DQ File Complete" value={v(COL['DQ File Complete'])} onChange={val => set(COL['DQ File Complete'], val)} options={YES_NO} />
            <Field label="I-9 Complete" value={v(COL['I-9 Complete'])} onChange={val => set(COL['I-9 Complete'], val)} options={YES_NO} />
            <Field label="SIG / FedEx ID Activated" value={v(COL['SIG / FedEx ID Activated'])} onChange={val => set(COL['SIG / FedEx ID Activated'], val)} options={YES_NO} />
            <Field label="English Assessment" value={v(COL['English Assessment'])} onChange={val => set(COL['English Assessment'], val)} options={COMPLIANCE_VALS} />
            <Field label="Orientation" value={v(COL['Orientation'])} onChange={val => set(COL['Orientation'], val)} options={COMPLIANCE_VALS} />
            <Field label="Final Approval" value={v(COL['Final Approval'])} onChange={val => set(COL['Final Approval'], val)} options={COMPLIANCE_VALS} />
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>🚀 Onboarding</div>
          <div style={S.grid}>
            <Field label="Hire Date" value={v(COL['Hire Date'])} onChange={val => set(COL['Hire Date'], val)} />
            <Field label="Start Date" value={v(COL['Start Date'])} onChange={val => set(COL['Start Date'], val)} />
            <Field label="Assigned Terminal" value={v(COL['Assigned Terminal'])} onChange={val => set(COL['Assigned Terminal'], val)} />
            <Field label="Assigned Manager" value={v(COL['Assigned Manager'])} onChange={val => set(COL['Assigned Manager'], val)} />
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={S.grid}>
            <Field label="Notes" value={v(COL['Notes'])} onChange={val => set(COL['Notes'], val)} type="textarea" fullWidth />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button style={S.btn('#6c757d')} onClick={onClose}>Cancel</button>
          <button style={S.btn('#198754')} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '💾 Save to Google Sheets'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterPhase, setFilterPhase] = useState('');
  const [filterRecruiter, setFilterRecruiter] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await fetchCandidates();
      setCandidates(rows);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (rowIndex, rowData, isNew) => {
    setSaving('Saving to Google Sheets...');
    if (isNew) {
      await appendCandidate(rowData);
      setCandidates(c => [...c, rowData]);
    } else {
      await updateCandidate(rowIndex, rowData);
      setCandidates(c => c.map((r, i) => i === rowIndex ? rowData : r));
    }
    setSaving('');
  };

  // ── Filter ──
  const filtered = candidates.filter(row => {
    const name = (row[COL['Name']] || '').toLowerCase();
    const phone = (row[COL['Phone']] || '').toLowerCase();
    const status = row[COL['Pipeline Status']] || '';
    const phase = row[COL['Current Phase']] || '';
    const recruiter = row[COL['Recruiter']] || '';

    if (search && !name.includes(search.toLowerCase()) && !phone.includes(search.toLowerCase())) return false;
    if (filterPhase && phase !== filterPhase) return false;
    if (filterRecruiter && recruiter !== filterRecruiter) return false;
    if (filterStatus === 'active' && !ACTIVE_STATUSES.has(status)) return false;
    if (filterStatus === 'hired' && status !== 'Hired') return false;
    if (filterStatus === 'declined' && !DECLINED_STATUSES.has(status)) return false;
    return true;
  });

  // ── Stats ──
  const stats = {
    total: candidates.length,
    active: candidates.filter(r => ACTIVE_STATUSES.has(r[COL['Pipeline Status']])).length,
    hired: candidates.filter(r => r[COL['Pipeline Status']] === 'Hired').length,
    overdue: candidates.filter(r => isOverdue(r)).length,
    declined: candidates.filter(r => DECLINED_STATUSES.has(r[COL['Pipeline Status']])).length,
  };

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.headerTitle}>🚛 Triangle Transports — CDL Driver ATS</div>
          <div style={S.headerSub}>
            FedEx Ground Linehaul · Google Sheets Sync
            {lastRefresh && ` · Last sync: ${lastRefresh.toLocaleTimeString()}`}
          </div>
        </div>
        <button style={S.btn('#0d6efd')} onClick={load}>🔄 Refresh</button>
      </div>

      {/* Stats */}
      <div style={S.statsRow}>
        {[
          { label: 'Total', num: stats.total, color: '#1a1a2e' },
          { label: 'Active', num: stats.active, color: '#0d6efd' },
          { label: 'Hired', num: stats.hired, color: '#198754' },
          { label: '⚠ Overdue', num: stats.overdue, color: '#dc3545' },
          { label: 'Declined', num: stats.declined, color: '#6c757d' },
        ].map(s => (
          <div key={s.label} style={S.stat}>
            <div style={{ ...S.statNum, color: s.color }}>{s.num}</div>
            <div style={S.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <input
          style={{ ...S.input, width: 220 }}
          placeholder="🔍 Search name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={S.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All candidates</option>
          <option value="active">Active only</option>
          <option value="hired">Hired</option>
          <option value="declined">Declined / Archived</option>
        </select>
        <select style={S.select} value={filterPhase} onChange={e => setFilterPhase(e.target.value)}>
          <option value="">All phases</option>
          {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select style={S.select} value={filterRecruiter} onChange={e => setFilterRecruiter(e.target.value)}>
          <option value="">All recruiters</option>
          {RECRUITERS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#666' }}>{filtered.length} candidates</span>
        <button style={S.btn('#198754')} onClick={() => setModal({ candidate: null, rowIndex: null, isNew: true })}>
          ➕ New Candidate
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: '0 24px 16px', background: '#f8d7da', border: '1px solid #f5c2c7', borderRadius: 8, padding: '10px 14px', color: '#842029', fontSize: 13 }}>
          ❌ {error} — <button onClick={load} style={{ background: 'none', border: 'none', color: '#842029', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
        </div>
      )}

      {/* Table */}
      <div style={S.tableWrap}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            Loading candidates from Google Sheets...
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                {['Name','Phone','Recruiter','Route / Position','CPM','Bonus','Current Phase','Pipeline Status','D&T','Days','Flags',''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={12} style={{ ...S.td, textAlign: 'center', color: '#999', padding: 40 }}>No candidates found</td></tr>
              ) : filtered.map((row, i) => {
                const realIndex = candidates.indexOf(row);
                const overdue = isOverdue(row);
                const flags = row[COL['Auto Flags']] || getAutoFlags(row);
                return (
                  <tr key={realIndex} style={{ background: overdue ? '#fff8e1' : undefined }}>
                    <td style={S.td}>
                      <strong>{row[COL['Name']] || '—'}</strong>
                      {overdue && <span style={{ marginLeft: 6, fontSize: 11, color: '#dc3545' }}>⚠ OVERDUE</span>}
                    </td>
                    <td style={S.td}>{row[COL['Phone']] || '—'}</td>
                    <td style={S.td}>{row[COL['Recruiter']] || '—'}</td>
                    <td style={S.td}>{row[COL['Route / Position']] || '—'}</td>
                    <td style={{ ...S.td, fontWeight: 600, color: '#198754' }}>{row[COL['CPM']] || '—'}</td>
                    <td style={S.td}>{row[COL['Sign in Bonus']] === 'Yes' ? '💰 Yes' : (row[COL['Sign in Bonus']] || '—')}</td>
                    <td style={S.td}>
                      <span style={S.badge(phaseColor(row[COL['Current Phase']]))}>
                        {row[COL['Current Phase']] || '—'}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={S.badge(statusColor(row[COL['Pipeline Status']]))}>
                        {row[COL['Pipeline Status']] || '—'}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: row[COL['Doubles & Triples']] === 'No' ? '#dc3545' : undefined }}>
                      {row[COL['Doubles & Triples']] || '—'}
                    </td>
                    <td style={{ ...S.td, color: Number(daysInPhase(row[COL['Date Entered Phase']])) > 2 ? '#dc3545' : undefined }}>
                      {daysInPhase(row[COL['Date Entered Phase']]) ?? '—'}
                    </td>
                    <td style={{ ...S.td, maxWidth: 180, fontSize: 11, color: '#dc3545' }}>
                      {flags || ''}
                    </td>
                    <td style={S.td}>
                      <button
                        style={{ ...S.btn('#0d6efd'), padding: '5px 12px', fontSize: 12 }}
                        onClick={() => setModal({ candidate: row, rowIndex: realIndex, isNew: false })}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <CandidateModal
          candidate={modal.candidate}
          rowIndex={modal.rowIndex}
          isNew={modal.isNew}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Saving toast */}
      {saving && <div style={S.saving}>{saving}</div>}
    </div>
  );
}
