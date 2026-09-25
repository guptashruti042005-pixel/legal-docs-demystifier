import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { 
  User, ShieldAlert, AlertTriangle, Calendar, DollarSign, HelpCircle, 
  Layers, MessageSquare, ArrowLeft, Languages, ClipboardList, CheckCircle, 
  Info, Briefcase, GraduationCap, CheckCircle2, Target, Code2, Award, ExternalLink, Globe,
  Download, Loader2
} from 'lucide-react';
import toast from '../utils/toast';
import { generateAnalysisPDF } from '../utils/pdfGenerator';

const AnalysisResultPage = () => {
  const { analysisId } = useParams();

  const [analysisRecord, setAnalysisRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [translating, setTranslating] = useState(false);
  const [currentAnalysisJSON, setCurrentAnalysisJSON] = useState(null);
  const [currentLang, setCurrentLang] = useState('en');
  const [checkedItems, setCheckedItems] = useState({});
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const toggleCheck = (idx) => {
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleDownloadSummary = async () => {
    if (generatingPdf || !analysisRecord) return;
    setGeneratingPdf(true);
    try {
      const result = await generateAnalysisPDF({
        analysisRecord,
        currentAnalysisJSON,
        currentLang
      });
      toast.success(`Summary PDF downloaded: ${result.filename}`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      toast.error('Unable to generate the summary PDF. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  useEffect(() => {
    const fetchAnalysisData = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/analyze/${analysisId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch analysis details');
        
        setAnalysisRecord(data.analysis);
        setCurrentAnalysisJSON(data.analysis.analysis);
        setCurrentLang(data.analysis.language || 'en');
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysisData();
  }, [analysisId]);

  const handleTranslate = async (langCode) => {
    if (langCode === currentLang) return;
    
    setTranslating(true);
    try {
      const res = await apiFetch(`/api/translation/${analysisId}`, {
        method: 'POST',
        body: JSON.stringify({ language: langCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Translation failed');

      setCurrentAnalysisJSON(data.translation);
      setCurrentLang(langCode);
      toast.success(`Translated to ${langCode === 'hi' ? 'Hindi' : 'English'}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTranslating(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-12 flex flex-col items-center justify-center min-h-[400px]">
        <div className="spinner mb-4"></div>
        <p className="font-semibold text-sm animate-pulse">Retrieving contract audit metrics...</p>
      </div>
    );
  }

  if (!analysisRecord) {
    return (
      <div className="container py-12 text-center">
        <ShieldAlert size={48} className="mx-auto text-red-500 mb-4" />
        <h3 className="font-bold text-lg">Report Not Found</h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1">This analysis could not be found or you do not have permission to view it.</p>
        <Link to="/dashboard" className="btn btn-primary btn-sm mt-4">Back to Dashboard</Link>
      </div>
    );
  }

  const { documentId } = analysisRecord;
  const analysis = currentAnalysisJSON || {};
  const isResume = (analysis.documentType || '').toLowerCase().includes('resume') 
    || (analysis.documentType || '').toLowerCase().includes('cv') 
    || (documentId?.documentType || '').toLowerCase().includes('resume')
    || (documentId?.documentType || '').toLowerCase().includes('cv')
    || (documentId?.documentType || '').toLowerCase() === 'resume'
    || (documentId?.fileName || '').toLowerCase().includes('resume')
    || (documentId?.fileName || '').toLowerCase().includes('cv')
    || (analysis.atsScore !== null && analysis.atsScore !== undefined);

  const getRiskBadge = (level) => {
    const l = (level || '').toLowerCase();
    if (l === 'high') return 'risk-high';
    if (l === 'medium') return 'risk-medium';
    return 'risk-low';
  };

  const getClauseBorder = (importance) => {
    const imp = (importance || '').toLowerCase();
    if (imp === 'high') return 'clause-legal';
    if (imp === 'medium') return 'clause-financial';
    return 'clause-operational';
  };

  return (
    <div className="container py-8 animate-fade-in">
      {/* Header breadcrumb & tools */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] font-semibold transition py-1">
          <ArrowLeft size={15} className="shrink-0" />
          <span>Back to Dashboard</span>
        </Link>

        {/* Translation Trigger & Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-lg p-0.5 bg-[var(--surface-2)] border border-[var(--border)]">
            <button
              onClick={() => handleTranslate('en')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${currentLang === 'en' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              disabled={translating}
            >
              <Languages size={13} className="shrink-0" />
              <span>EN</span>
            </button>
            <button
              onClick={() => handleTranslate('hi')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 ${currentLang === 'hi' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              disabled={translating}
            >
              <Languages size={13} className="shrink-0" />
              <span>हिन्दी</span>
            </button>
          </div>
          
          <Link
            to={`/chat/${documentId?._id || documentId}`}
            className="btn btn-secondary btn-sm inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:border-blue-300 transition"
          >
            <MessageSquare size={15} className="shrink-0 text-blue-500" />
            <span>AI Document Chat</span>
          </Link>
          <Link
            to={`/whatif/${documentId?._id || documentId}`}
            className="btn btn-secondary btn-sm inline-flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:border-purple-300 transition"
          >
            <Layers size={15} className="shrink-0 text-purple-500" />
            <span>What-If Scenario</span>
          </Link>

          <button
            onClick={handleDownloadSummary}
            disabled={generatingPdf}
            className="btn btn-secondary btn-sm inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:border-blue-300 transition cursor-pointer disabled:opacity-60"
            title="Download Summary Report (PDF)"
          >
            {generatingPdf ? (
              <>
                <Loader2 size={14} className="animate-spin shrink-0 text-blue-500" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download size={14} className="shrink-0 text-blue-500" />
                <span>Download Summary</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metadata Card */}
      <div className="card-hero p-6 mb-8 rounded-2xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`risk-badge ${getRiskBadge(analysis.riskLevel)}`}>
              {analysis.riskLevel} Risk
            </span>
            <span className="text-xs bg-slate-800 text-slate-300 font-bold px-2.5 py-0.5 rounded-full capitalize">
              {analysisRecord.persona} view
            </span>
            <span className="text-xs bg-slate-800 text-slate-300 font-bold px-2.5 py-0.5 rounded-full uppercase">
              {currentLang}
            </span>
          </div>
          <h2 className="font-display font-bold mt-2 text-white text-xl sm:text-2xl leading-tight break-words">
            {documentId?.fileName || 'Document Analysis'}
          </h2>
          <p className="text-xs text-slate-300 mt-1.5 font-medium">
            Category: {analysis.documentType || (documentId?.documentType === 'resume' ? 'Resume / CV' : documentId?.documentType) || 'Document Analysis'} • Confidence Score: {((analysis.confidenceScore || 0.9) * 100).toFixed(0)}%
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full lg:w-auto shrink-0">
          <div className="flex items-center gap-4 bg-slate-800/90 border border-slate-700/60 p-4 rounded-xl w-full sm:w-auto shrink-0 justify-around sm:justify-start">
            {isResume && analysis.atsScore !== null && (
              <>
                <div className="text-center px-2">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">ATS Score</p>
                  <p className={`font-bold text-base mt-0.5 ${analysis.atsScore >= 80 ? 'text-green-400' : analysis.atsScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{analysis.atsScore}%</p>
                </div>
                <div className="w-px h-8 bg-slate-700"></div>
              </>
            )}
            <div className="text-center px-2">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Status</p>
              <p className="font-bold text-base text-green-400 mt-0.5">READY</p>
            </div>
            <div className="w-px h-8 bg-slate-700"></div>
            <div className="text-center px-2">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Confidence</p>
              <p className="font-bold text-base text-blue-400 mt-0.5">{((analysis.confidenceScore || 0.9) * 100).toFixed(0)}%</p>
            </div>
          </div>

          {/* Prominent Download Summary Button near Title and Status */}
          <button
            id="download-summary-btn"
            onClick={handleDownloadSummary}
            disabled={generatingPdf}
            className="btn btn-primary inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-semibold shadow-lg hover:shadow-blue-500/25 transition-all text-xs sm:text-sm whitespace-nowrap cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 text-white"
            title="Download Professional Summary Report (PDF)"
          >
            {generatingPdf ? (
              <>
                <Loader2 size={16} className="animate-spin shrink-0" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download size={16} className="shrink-0" />
                <span>Download Summary</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab controls */}
      <div className="tabs-nav mb-8">
        <button onClick={() => setActiveTab('summary')} className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}>Overview Summary</button>
        {isResume ? (
          <>
            <button onClick={() => setActiveTab('skills')} className={`tab-btn ${activeTab === 'skills' ? 'active' : ''}`}>Extracted Skills</button>
            <button onClick={() => setActiveTab('projects')} className={`tab-btn ${activeTab === 'projects' ? 'active' : ''}`}>Projects</button>
            <button onClick={() => setActiveTab('experience')} className={`tab-btn ${activeTab === 'experience' ? 'active' : ''}`}>Experience & Education</button>
            <button onClick={() => setActiveTab('ats')} className={`tab-btn ${activeTab === 'ats' ? 'active' : ''}`}>ATS Score & Breakdown</button>
            <button onClick={() => setActiveTab('jdmatch')} className={`tab-btn ${activeTab === 'jdmatch' ? 'active' : ''}`}>Job Match</button>
            <button onClick={() => setActiveTab('contact')} className={`tab-btn ${activeTab === 'contact' ? 'active' : ''}`}>Candidate Contacts</button>
          </>
        ) : (
          <>
            <button onClick={() => setActiveTab('clauses')} className={`tab-btn ${activeTab === 'clauses' ? 'active' : ''}`}>Key Clauses</button>
            <button onClick={() => setActiveTab('flags')} className={`tab-btn ${activeTab === 'flags' ? 'active' : ''}`}>Red Flags & Risks</button>
            <button onClick={() => setActiveTab('obligations')} className={`tab-btn ${activeTab === 'obligations' ? 'active' : ''}`}>Obligations & Dates</button>
            <button onClick={() => setActiveTab('compliance')} className={`tab-btn ${activeTab === 'compliance' ? 'active' : ''}`}>Missing Clauses</button>
            <button onClick={() => setActiveTab('checklist')} className={`tab-btn ${activeTab === 'checklist' ? 'active' : ''}`}>Action Checklist & Caveats</button>
          </>
        )}
      </div>

      {/* Tab Content 1: Overview Summary */}
      {activeTab === 'summary' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="card p-6 flex flex-col">
              <h3 className="font-display font-semibold text-base mb-4 text-[var(--text-primary)] flex items-center gap-2.5">
                <ClipboardList size={20} className="text-blue-500 shrink-0" />
                <span>Executive Summary</span>
              </h3>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line font-medium flex-1">
                {analysis.executiveSummary || 'No summary available.'}
              </p>
            </div>
            
            <div className="card p-6 flex flex-col">
              <h3 className="font-display font-semibold text-base mb-4 text-[var(--text-primary)] flex items-center gap-2.5">
                <Info size={20} className="text-teal-500 shrink-0" />
                <span>Plain Language Breakdown</span>
              </h3>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line font-medium flex-1">
                {analysis.plainLanguageSummary || 'No breakdown details generated.'}
              </p>
            </div>
          </div>

          {/* Recommendations Card */}
          <div className="card p-6">
            <h3 className="font-display font-semibold text-base mb-4 text-[var(--text-primary)] flex items-center gap-2.5">
              <CheckCircle size={20} className="text-green-500 shrink-0" />
              <span>Recommendations & Action Items</span>
            </h3>
            {analysis.recommendations && analysis.recommendations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                {analysis.recommendations.map((rec, i) => (
                  <div key={i} className="p-4 bg-[var(--surface-2)] rounded-lg border-l-4 border-green-500 text-xs flex flex-col justify-center">
                    <p className="font-bold text-sm text-[var(--text-primary)] mb-1">{rec.action}</p>
                    <p className="text-[var(--text-secondary)] leading-relaxed">{rec.rationale}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">No recommendations identified.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab Content 2: Key Clauses */}
      {activeTab === 'clauses' && (
        <div className="card p-6">
          <h3 className="font-display font-semibold text-base mb-6 text-[var(--text-primary)] flex items-center gap-2.5">
            <Layers size={20} className="text-indigo-500 shrink-0" />
            <span>Contractual Key Clauses</span>
          </h3>
          {analysis.importantClauses && analysis.importantClauses.length > 0 ? (
            <div className="flex flex-col gap-4">
              {analysis.importantClauses.map((cls, i) => (
                <div key={i} className={`clause-card ${getClauseBorder(cls.importance)}`}>
                  <div className="flex justify-between items-start gap-4">
                    <h4 className="font-bold text-sm text-[var(--text-primary)] leading-snug">{cls.title || 'Clause'}</h4>
                    <span className="text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded shrink-0">
                      {cls.importance} importance
                    </span>
                  </div>
                  {cls.excerpt && cls.excerpt !== 'Information Not Found In Document' && (
                    <blockquote className="my-3 p-3.5 bg-[var(--surface-2)] rounded border-l-4 border-[var(--border-strong)] font-mono text-[11.5px] text-[var(--text-primary)] font-semibold italic leading-relaxed">
                      "{cls.excerpt}"
                    </blockquote>
                  )}
                  <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
                    <span className="font-semibold text-[var(--text-primary)]">Explanation:</span> {cls.explanation}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic">No clause metrics found.</p>
          )}
        </div>
      )}

      {/* Tab Content 3: Red Flags */}
      {activeTab === 'flags' && (
        <div className="card p-6">
          <h3 className="font-display font-semibold text-base mb-6 text-[var(--text-primary)] flex items-center gap-2.5">
            <AlertTriangle size={20} className="text-red-500 shrink-0" />
            <span>Identified Risks & Red Flags</span>
          </h3>
          {analysis.redFlags && analysis.redFlags.length > 0 ? (
            <div className="flex flex-col gap-4">
              {analysis.redFlags.map((flag, i) => (
                <div key={i} className="p-5 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl">
                  <div className="flex justify-between items-start gap-4">
                    <h4 className="font-bold text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                      <ShieldAlert size={16} className="shrink-0" />
                      <span>{flag.title || 'Red Flag'}</span>
                    </h4>
                    <span className="text-[10px] font-bold uppercase bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2.5 py-1 rounded shrink-0">
                      {flag.severity} severity
                    </span>
                  </div>
                  
                  {flag.excerpt && flag.excerpt !== 'Information Not Found In Document' && (
                    <blockquote className="my-3 p-3.5 bg-[var(--surface-2)] rounded border-l-4 border-red-500 font-mono text-[11.5px] text-[var(--text-primary)] font-semibold italic leading-relaxed">
                      "{flag.excerpt}"
                    </blockquote>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-xs">
                    <div className="p-3 bg-red-100/40 dark:bg-red-950/40 rounded-lg">
                      <p className="font-bold text-[var(--text-primary)] mb-1">Explanation of Risk:</p>
                      <p className="text-[var(--text-secondary)] leading-relaxed">{flag.risk}</p>
                    </div>
                    <div className="p-3 bg-red-100/40 dark:bg-red-950/40 rounded-lg">
                      <p className="font-bold text-[var(--text-primary)] mb-1">Potential Consequences:</p>
                      <p className="text-[var(--text-secondary)] leading-relaxed">{flag.consequences}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle size={40} className="mx-auto text-green-500 mb-2" />
              <p className="font-semibold text-sm">No red flags detected!</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">This agreement appears to follow standard fair parameters.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content 4: Obligations & Dates */}
      {activeTab === 'obligations' && (
        <div className="flex flex-col gap-6">
          {/* Financial Obligations */}
          <div className="card p-6">
            <h3 className="font-display font-semibold text-base mb-4 text-[var(--text-primary)] flex items-center gap-2.5">
              <DollarSign size={20} className="text-yellow-500 shrink-0" />
              <span>Financial Obligations & Penalties</span>
            </h3>
            {analysis.financialObligations && analysis.financialObligations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-strong)] text-[var(--text-muted)] font-bold">
                      <th className="py-2.5 pr-4">Obligation Description</th>
                      <th className="py-2.5 pr-4 whitespace-nowrap">Amount</th>
                      <th className="py-2.5">Trigger Terms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.financialObligations.map((ob, i) => (
                      <tr key={i} className="border-b border-[var(--border)] font-medium">
                        <td className="py-3 pr-4 text-[var(--text-primary)] font-semibold">{ob.description}</td>
                        <td className="py-3 pr-4 whitespace-nowrap"><span className={ob.amount.includes('Not Found') ? 'text-[var(--text-muted)] italic' : 'hl-amount'}>{ob.amount}</span></td>
                        <td className="py-3 text-[var(--text-secondary)] leading-relaxed">{ob.terms}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">No financial metrics detected.</p>
            )}
          </div>

          {/* Important Dates */}
          <div className="card p-6">
            <h3 className="font-display font-semibold text-base mb-4 text-[var(--text-primary)] flex items-center gap-2.5">
              <Calendar size={20} className="text-blue-500 shrink-0" />
              <span>Critical Timeframes & Deadlines</span>
            </h3>
            {analysis.importantDates && analysis.importantDates.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-strong)] text-[var(--text-muted)] font-bold">
                      <th className="py-2.5 pr-4">Significance</th>
                      <th className="py-2.5 pr-4 whitespace-nowrap">Critical Date</th>
                      <th className="py-2.5">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.importantDates.map((dt, i) => (
                      <tr key={i} className="border-b border-[var(--border)] font-medium">
                        <td className="py-3 pr-4 text-[var(--text-primary)] font-semibold">{dt.description}</td>
                        <td className="py-3 pr-4 whitespace-nowrap"><span className={dt.date.includes('Not Found') ? 'text-[var(--text-muted)] italic' : 'hl-date'}>{dt.date}</span></td>
                        <td className="py-3 text-[var(--text-secondary)] leading-relaxed">{dt.significance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">No dates or milestones detected.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab Content 5: Missing Clauses */}
      {activeTab === 'compliance' && (
        <div className="card p-6">
          <h3 className="font-display font-semibold text-base mb-2 text-[var(--text-primary)] flex items-center gap-2.5">
            <HelpCircle size={20} className="text-purple-500 shrink-0" />
            <span>Missing Clauses & Protective Exclusions</span>
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-6 leading-relaxed">
            AI has scanned the contract for key clauses that are typical for this document type but are currently missing. Adding these clauses can protect you from liabilities.
          </p>

          {analysis.missingClauses && analysis.missingClauses.length > 0 ? (
            <div className="flex flex-col gap-4">
              {analysis.missingClauses.map((mc, i) => (
                <div key={i} className="p-4 bg-[var(--surface-2)] rounded-lg border-l-4 border-purple-500 text-xs">
                  <h4 className="font-bold text-sm text-[var(--text-primary)] mb-1">{mc.clause}</h4>
                  <p className="text-[var(--text-secondary)] leading-relaxed mt-1">{mc.explanation}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic">No critical missing clauses detected.</p>
          )}
        </div>
      )}

      {/* Tab Content: Extracted Skills */}
      {activeTab === 'skills' && (
        <div className="flex flex-col gap-6">
          <div className="card p-6">
            <h3 className="font-display font-semibold text-base mb-2 text-[var(--text-primary)] flex items-center gap-2.5">
              <Layers size={20} className="text-blue-500 shrink-0" />
              <span>Extracted Candidate Skills</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-6">
              Identified and canonicalized technical frameworks, programming languages, and domain competencies.
            </p>
            <div className="flex flex-wrap gap-2.5">
              {(analysis.skills || analysis.extractedSkills) && (analysis.skills || analysis.extractedSkills).length > 0 ? (
                (analysis.skills || analysis.extractedSkills).map((skill, i) => (
                  <span
                    key={i}
                    className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 font-semibold px-3.5 py-1.5 rounded-full text-xs hover:scale-105 transition shrink-0"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <p className="text-xs text-[var(--text-muted)] italic">No skills extracted from this profile.</p>
              )}
            </div>
          </div>

          {(analysis.matchedSkills?.length > 0 || analysis.missingSkills?.length > 0 || analysis.jobDescriptionMatch) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              <div className="card p-6">
                <h4 className="font-display font-semibold text-sm mb-2 text-green-700 dark:text-green-400 flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-green-500" />
                  <span>Matched Target Skills ({(analysis.jobDescriptionMatch?.matchedSkills || analysis.matchedSkills)?.length || 0})</span>
                </h4>
                <p className="text-xs text-[var(--text-secondary)] mb-4">
                  Skills from the target Job Description found in this resume:
                </p>
                <div className="flex flex-wrap gap-2">
                  {(analysis.jobDescriptionMatch?.matchedSkills || analysis.matchedSkills)?.length > 0 ? (
                    (analysis.jobDescriptionMatch?.matchedSkills || analysis.matchedSkills).map((skill, i) => (
                      <span key={i} className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 font-semibold px-3 py-1 rounded-full text-xs shrink-0">
                        ✓ {skill}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] italic">No specific keyword overlap identified.</p>
                  )}
                </div>
              </div>

              <div className="card p-6">
                <h4 className="font-display font-semibold text-sm mb-2 text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0 text-amber-500" />
                  <span>Missing Target Skills ({(analysis.jobDescriptionMatch?.missingSkills || analysis.missingSkills)?.length || 0})</span>
                </h4>
                <p className="text-xs text-[var(--text-secondary)] mb-4">
                  Desired in the target Job Description but missing from this resume:
                </p>
                <div className="flex flex-wrap gap-2">
                  {(analysis.jobDescriptionMatch?.missingSkills || analysis.missingSkills)?.length > 0 ? (
                    (analysis.jobDescriptionMatch?.missingSkills || analysis.missingSkills).map((skill, i) => (
                      <span key={i} className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold px-3 py-1 rounded-full text-xs shrink-0">
                        + {skill}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] italic">No critical missing skills detected.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Projects */}
      {activeTab === 'projects' && (
        <div className="card p-6">
          <h3 className="font-display font-semibold text-base mb-2 text-[var(--text-primary)] flex items-center gap-2.5">
            <Code2 size={20} className="text-indigo-500 shrink-0" />
            <span>Technical & Personal Projects</span>
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-6">
            Documented engineering and software projects demonstrating practical competencies.
          </p>
          {analysis.projects && analysis.projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.projects.map((proj, i) => (
                <div key={i} className="p-4 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-bold text-sm text-[var(--text-primary)] leading-snug">{proj.name || 'Project'}</h4>
                      {proj.url && (
                        <a
                          href={proj.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 shrink-0 font-medium"
                        >
                          <span>Link</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    {proj.technologies && proj.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {proj.technologies.map((t, ti) => (
                          <span key={ti} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100/60 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {proj.description && proj.description.length > 0 && (
                      <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] space-y-1">
                        {proj.description.map((d, di) => (
                          <li key={di} className="leading-relaxed">{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic">No projects parsed from this document.</p>
          )}
        </div>
      )}

      {/* Tab Content: ATS Score & Breakdown */}
      {activeTab === 'ats' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr] gap-6 items-start">
            {/* Progress Circular Ring */}
            <div className="card p-6 flex flex-col items-center justify-center text-center">
              <h4 className="font-display font-semibold text-xs text-[var(--text-muted)] uppercase tracking-wider mb-6">ATS Compatibility</h4>
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="var(--border)" strokeWidth="8" fill="transparent" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke={analysis.atsScore >= 80 ? '#10B981' : analysis.atsScore >= 50 ? '#F59E0B' : '#EF4444'}
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * (analysis.atsScore || 0)) / 100}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-3xl font-extrabold text-[var(--text-primary)]">{analysis.atsScore || 0}%</span>
                  <span className="text-[10px] block text-[var(--text-muted)] font-bold uppercase mt-0.5">COMPATIBILITY</span>
                </div>
              </div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] mt-6 leading-relaxed">
                {analysis.atsAssessment || (analysis.atsScore >= 80 ? 'Strong ATS alignment based on detected resume structure and keywords.' : analysis.atsScore >= 60 ? 'Good foundation, with opportunities to expand targeted keywords.' : 'Basic ATS compatibility. Review recommended adjustments below.')}
              </p>
            </div>

            {/* Transparent Factor Breakdown */}
            <div className="card p-6 flex flex-col justify-between">
              <h4 className="font-display font-semibold text-sm text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Layers size={16} className="text-indigo-500" />
                <span>Transparent Factor Breakdown</span>
              </h4>
              <div className="space-y-3">
                {[
                  { label: 'Contact Information', key: 'contact', max: 10 },
                  { label: 'Core Section Structure', key: 'sections', max: 15 },
                  { label: 'Technical Skills Breadth', key: 'skills', max: 20 },
                  { label: 'Experience / Practical Depth', key: 'experience', max: 20 },
                  { label: 'Education Completeness', key: 'education', max: 10 },
                  { label: 'Hands-on Projects', key: 'projects', max: 15 },
                  { label: 'Formatting & Parsability', key: 'formatting', max: 10 }
                ].map((item, idx) => {
                  const score = analysis.atsScoreBreakdown && typeof analysis.atsScoreBreakdown === 'object'
                    ? (analysis.atsScoreBreakdown[item.key] !== undefined ? analysis.atsScoreBreakdown[item.key] : Math.round(((analysis.atsScore || 70) / 100) * item.max))
                    : Math.round(((analysis.atsScore || 70) / 100) * item.max);
                  const pct = Math.round((score / item.max) * 100);
                  return (
                    <div key={idx} className="text-xs">
                      <div className="flex justify-between font-semibold mb-1">
                        <span className="text-[var(--text-secondary)]">{item.label}</span>
                        <span className="text-[var(--text-primary)] font-bold">{score}/{item.max} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-[var(--surface-2)] rounded-full h-2 overflow-hidden border border-[var(--border)]">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Feedback & Improvement Suggestions */}
          <div className="card p-6">
            <h3 className="font-display font-semibold text-base mb-4 text-[var(--text-primary)] flex items-center gap-2.5">
              <CheckCircle size={20} className="text-yellow-500 shrink-0" />
              <span>ATS Strengths & Actionable Improvements</span>
            </h3>
            {/* If resumeFeedback is object with strengths and improvements */}
            {analysis.resumeFeedback && typeof analysis.resumeFeedback === 'object' && !Array.isArray(analysis.resumeFeedback) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.resumeFeedback.strengths && analysis.resumeFeedback.strengths.length > 0 && (
                  <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                      <CheckCircle2 size={14} />
                      <span>Detected Strengths</span>
                    </h4>
                    <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                      {analysis.resumeFeedback.strengths.map((str, si) => (
                        <li key={si} className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.resumeFeedback.improvements && analysis.resumeFeedback.improvements.length > 0 && (
                  <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      <span>Recommended Improvements</span>
                    </h4>
                    <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                      {analysis.resumeFeedback.improvements.map((imp, ii) => (
                        <li key={ii} className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : Array.isArray(analysis.resumeFeedback) && analysis.resumeFeedback.length > 0 ? (
              <div className="flex flex-col gap-4">
                {analysis.resumeFeedback.map((fb, i) => (
                  <div key={i} className="p-4 bg-[var(--surface-2)] rounded-lg border-l-4 border-yellow-500 text-xs">
                    <span className="font-bold text-[10px] uppercase text-yellow-700 bg-yellow-100 dark:bg-yellow-950/40 dark:text-yellow-400 px-2.5 py-1 rounded inline-block">
                      {fb.category || 'Feedback'}
                    </span>
                    <p className="font-bold text-sm text-[var(--text-primary)] mt-2">{fb.issue}</p>
                    <p className="text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                      <span className="font-bold text-[var(--text-primary)]">Suggested improvement:</span> {fb.suggestion}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">No specific issues or improvements generated.</p>
            )}
          </div>

          {/* Actionable Suggestions Checklist */}
          {(analysis.suggestions?.length > 0 || analysis.actionItems?.length > 0 || (analysis.resumeFeedback && typeof analysis.resumeFeedback === 'object' && analysis.resumeFeedback.improvements?.length > 0)) && (
            <div className="card p-6">
              <h3 className="font-display font-semibold text-base mb-4 text-[var(--text-primary)] flex items-center gap-2.5">
                <ClipboardList size={20} className="text-blue-500 shrink-0" />
                <span>Interactive ATS Action Checklist</span>
              </h3>
              <div className="flex flex-col gap-2.5">
                {(analysis.suggestions?.length > 0 ? analysis.suggestions : (analysis.actionItems?.length > 0 ? analysis.actionItems : analysis.resumeFeedback?.improvements || [])).map((act, i) => (
                  <label
                    key={i}
                    className={`flex items-start gap-3 p-3.5 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] cursor-pointer text-xs font-semibold select-none hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition ${checkedItems[i] ? 'opacity-50 line-through' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={!!checkedItems[i]}
                      onChange={() => toggleCheck(i)}
                      className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
                    />
                    <span className="text-[var(--text-primary)] leading-snug flex-1">{act}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Job Match */}
      {activeTab === 'jdmatch' && (
        <div className="flex flex-col gap-6">
          <div className="card p-6">
            <h3 className="font-display font-semibold text-base mb-2 text-[var(--text-primary)] flex items-center gap-2.5">
              <Target size={20} className="text-indigo-500 shrink-0" />
              <span>Job Description Matching</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-6">
              Evaluation of candidate credentials and technical stack against target role requirements.
            </p>

            {analysis.jobDescriptionMatch ? (
              <div className="flex flex-col gap-6">
                <div className="p-4 bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <span className="font-bold text-sm text-[var(--text-primary)]">Relevance Score</span>
                    <span className="font-extrabold text-base text-indigo-600 dark:text-indigo-400">
                      {analysis.jobDescriptionMatch.matchPercentage || analysis.atsScore || 0}%
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {analysis.jobDescriptionMatch.summary || 'Profile evaluated against target job description.'}
                  </p>
                </div>

                {analysis.jobDescriptionMatch.suggestions && analysis.jobDescriptionMatch.suggestions.length > 0 && (
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text-muted)] mb-3">Alignment Suggestions</h4>
                    <div className="flex flex-col gap-2">
                      {analysis.jobDescriptionMatch.suggestions.map((sug, i) => (
                        <div key={i} className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-lg text-xs text-[var(--text-primary)] flex items-start gap-2">
                          <CheckCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
                          <span>{sug}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Target size={36} className="mx-auto text-[var(--text-muted)] mb-2" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">No Target Job Description Provided</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto">
                  No target job description was provided. Provide a job description during upload to calculate role-specific matching and keyword gap analysis.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Experience & Education */}
      {activeTab === 'experience' && (
        <div className="flex flex-col gap-6">
          {/* Work Experience */}
          <div className="card p-6">
            <h3 className="font-display font-semibold text-base mb-4 text-[var(--text-primary)] flex items-center gap-2.5">
              <Briefcase size={20} className="text-blue-500 shrink-0" />
              <span>Work Experience</span>
            </h3>
            {analysis.experience && analysis.experience.length > 0 ? (
              <div className="flex flex-col gap-4">
                {analysis.experience.map((exp, i) => (
                  <div key={i} className="p-4 bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                      <h4 className="font-bold text-sm text-[var(--text-primary)]">{exp.role || 'Role'}</h4>
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{exp.duration || ''}</span>
                    </div>
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                      {exp.company || ''}{exp.location ? ` • ${exp.location}` : ''}
                    </p>
                    {(exp.description || exp.highlights) && (exp.description || exp.highlights).length > 0 && (
                      <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] space-y-1 mt-2">
                        {(exp.description || exp.highlights).map((h, j) => (
                          <li key={j} className="leading-relaxed">{h}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">No structured work experience records parsed from this document.</p>
            )}
          </div>

          {/* Education */}
          <div className="card p-6">
            <h3 className="font-display font-semibold text-base mb-4 text-[var(--text-primary)] flex items-center gap-2.5">
              <GraduationCap size={20} className="text-purple-500 shrink-0" />
              <span>Education & Credentials</span>
            </h3>
            {analysis.education && analysis.education.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {analysis.education.map((edu, i) => (
                  <div key={i} className="p-4 bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">{edu.degree || 'Degree'}</h4>
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold mt-0.5">{edu.institution || edu.college || ''}</p>
                    {edu.field && <p className="text-xs text-[var(--text-secondary)] mt-1">Field: {edu.field}</p>}
                    {(edu.year || edu.graduationDate || edu.duration) && (
                      <p className="text-[11px] text-[var(--text-muted)] mt-1">Year: {edu.year || edu.graduationDate || edu.duration}</p>
                    )}
                    {(edu.score || edu.cgpa || edu.gpa || edu.details) && (
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">
                        Grade/Score: {edu.score || edu.cgpa || edu.gpa || edu.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">No education history parsed from this document.</p>
            )}
          </div>

          {/* Certifications if available */}
          {analysis.certifications && analysis.certifications.length > 0 && (
            <div className="card p-6">
              <h3 className="font-display font-semibold text-base mb-4 text-[var(--text-primary)] flex items-center gap-2.5">
                <Award size={20} className="text-amber-500 shrink-0" />
                <span>Certifications & Accreditations</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {analysis.certifications.map((cert, i) => (
                  <div key={i} className="p-3.5 bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
                    <h4 className="font-bold text-xs text-[var(--text-primary)]">{cert.name || cert}</h4>
                    {cert.issuer && <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">{cert.issuer}</p>}
                    {cert.date && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{cert.date}</p>}
                    {cert.credentialUrl && (
                      <a href={cert.credentialUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:underline mt-1 inline-flex items-center gap-1">
                        <span>View Credential</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achievements if available */}
          {analysis.achievements && analysis.achievements.length > 0 && (
            <div className="card p-6">
              <h3 className="font-display font-semibold text-base mb-4 text-[var(--text-primary)] flex items-center gap-2.5">
                <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                <span>Honors & Key Achievements</span>
              </h3>
              <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
                {analysis.achievements.map((ach, i) => (
                  <li key={i} className="flex items-start gap-2 p-2.5 bg-[var(--surface-2)] rounded-lg">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span className="leading-relaxed">{typeof ach === 'string' ? ach : (ach.title || JSON.stringify(ach))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Candidate Contacts */}
      {activeTab === 'contact' && (
        <div className="card p-6 max-w-3xl">
          <h3 className="font-display font-semibold text-base mb-6 text-[var(--text-primary)] flex items-center gap-2.5">
            <User size={20} className="text-blue-500 shrink-0" />
            <span>Candidate Contact Information</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[var(--text-secondary)] font-medium">
            <div className="p-3.5 bg-[var(--surface-2)] rounded-lg border border-[var(--border)]">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">Contact Name</span>
              <p className="text-sm font-semibold text-[var(--text-primary)] mt-1 break-words">
                {analysis.personalInfo?.name || analysis.contactInfo?.name || 'Information Not Found In Document'}
              </p>
            </div>
            <div className="p-3.5 bg-[var(--surface-2)] rounded-lg border border-[var(--border)]">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">Email Address</span>
              <p className="text-sm font-semibold text-[var(--text-primary)] mt-1 break-all">
                {analysis.personalInfo?.email || analysis.contactInfo?.email || 'Information Not Found In Document'}
              </p>
            </div>
            <div className="p-3.5 bg-[var(--surface-2)] rounded-lg border border-[var(--border)]">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">Phone Number</span>
              <p className="text-sm font-semibold text-[var(--text-primary)] mt-1 break-words">
                {analysis.personalInfo?.phone || analysis.contactInfo?.phone || 'Information Not Found In Document'}
              </p>
            </div>
            <div className="p-3.5 bg-[var(--surface-2)] rounded-lg border border-[var(--border)]">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">Location</span>
              <p className="text-sm font-semibold text-[var(--text-primary)] mt-1 break-words">
                {analysis.personalInfo?.location || 'Information Not Found In Document'}
              </p>
            </div>
            <div className="p-3.5 bg-[var(--surface-2)] rounded-lg border border-[var(--border)]">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">LinkedIn</span>
              {analysis.personalInfo?.linkedin ? (
                <a href={analysis.personalInfo.linkedin} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline mt-1 block break-all">
                  {analysis.personalInfo.linkedin}
                </a>
              ) : (
                <p className="text-sm font-semibold text-[var(--text-muted)] mt-1 italic">Not provided</p>
              )}
            </div>
            <div className="p-3.5 bg-[var(--surface-2)] rounded-lg border border-[var(--border)]">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">GitHub</span>
              {analysis.personalInfo?.github ? (
                <a href={analysis.personalInfo.github} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline mt-1 block break-all">
                  {analysis.personalInfo.github}
                </a>
              ) : (
                <p className="text-sm font-semibold text-[var(--text-muted)] mt-1 italic">Not provided</p>
              )}
            </div>
            <div className="p-3.5 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] sm:col-span-2">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">Portfolio / Websites</span>
              {analysis.personalInfo?.portfolio ? (
                <a href={analysis.personalInfo.portfolio} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline mt-1 block break-all">
                  {analysis.personalInfo.portfolio}
                </a>
              ) : analysis.contactInfo?.links ? (
                <p className="text-sm font-semibold text-[var(--text-primary)] mt-1 break-all">{analysis.contactInfo.links}</p>
              ) : (
                <p className="text-sm font-semibold text-[var(--text-muted)] mt-1 italic">Not provided</p>
              )}
              {analysis.personalInfo?.otherLinks && analysis.personalInfo.otherLinks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {analysis.personalInfo.otherLinks.map((link, li) => (
                    <a key={li} href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1 bg-[var(--surface-1)] px-2.5 py-1 rounded border border-[var(--border)]">
                      <Globe size={11} />
                      <span>{link.replace(/^https?:\/\//, '')}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 9: Action Items & Caveats (Contracts) */}
      {activeTab === 'checklist' && (
        <div className="flex flex-col gap-6">
          {/* Action checklist */}
          <div className="card p-6">
            <h3 className="font-display font-semibold text-base mb-2 text-[var(--text-primary)] flex items-center gap-2.5">
              <ClipboardList size={20} className="text-blue-500 shrink-0" />
              <span>Interactive Contract Checklist</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
              Check off tasks as you complete them to track obligations chronologically.
            </p>
            {analysis.actionItems && analysis.actionItems.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {analysis.actionItems.map((act, i) => (
                  <label
                    key={i}
                    className={`flex items-start gap-3 p-3.5 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] cursor-pointer text-xs font-semibold select-none hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition ${checkedItems[i] ? 'opacity-50 line-through' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={!!checkedItems[i]}
                      onChange={() => toggleCheck(i)}
                      className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
                    />
                    <span className="text-[var(--text-primary)] leading-snug flex-1">{act}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">No daily operational checklist items extracted.</p>
            )}
          </div>

          {/* Hidden Caveats */}
          <div className="card p-6 border-l-4 border-amber-500">
            <h3 className="font-display font-semibold text-base mb-2 text-[var(--text-primary)] flex items-center gap-2.5">
              <AlertTriangle size={20} className="text-amber-500 shrink-0" />
              <span>Hidden Caveats & Warning Clauses</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
              AI flags hidden auto-renewal clauses, unilateral edits, or hidden interest fees:
            </p>
            {analysis.hiddenCaveats && analysis.hiddenCaveats.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {analysis.hiddenCaveats.map((cav, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg text-xs leading-relaxed text-amber-800 dark:text-amber-300 font-semibold"
                  >
                    <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span className="flex-1">{cav}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">No hidden traps or caveats detected.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisResultPage;
