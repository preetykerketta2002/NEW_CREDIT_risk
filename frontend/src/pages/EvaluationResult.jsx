import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { evaluateEntity, getEntities } from '../services/api';

export default function EvaluationResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [evaluation, setEvaluation] = useState(null);
  const [entity, setEntity] = useState(null);

  useEffect(() => {
    async function loadAndEvaluate() {
      try {
        setLoading(true);
        const allEntities = await getEntities();
        const found = allEntities.find((e) => e.entity_id === id);

        if (!found) {
          alert('Entity not found');
          navigate('/');
          return;
        }

        setEntity(found);
        const result = await evaluateEntity(found);
        setEvaluation(result);
      } catch (err) {
        console.error('Evaluation failed:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAndEvaluate();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="dashboard-container" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <h2>Evaluating Credit Risk for {id}...</h2>
      </div>
    );
  }

  const mlRisk = evaluation?.ml_prediction || 'Low';
  const finalEvaluation = evaluation?.final_evaluation || mlRisk;
  const decisionStatus = evaluation?.decision_status || 'Pending review';
  const ruleCounts = evaluation?.rule_assessment || { low: 0, medium: 0, high: 0 };
  const riskFactors = evaluation?.risk_factors || [];
  const ruleFlagsLabel = ruleCounts.high > 0
    ? 'High-risk factors detected'
    : ruleCounts.medium > 0
      ? 'Medium-risk factors detected'
      : 'No elevated factors detected';

  const formatFactorName = (factor) => ({
    revenue_cagr_3y_pct: 'Revenue CAGR 3Y',
    auditor_tier: 'Auditor Tier',
    interest_coverage: 'Interest Coverage',
    governance_score_0_100: 'Governance Score',
    industry_cyclicality: 'Industry Cyclicality',
  }[factor] || factor.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()));

  return (
    <div className="dashboard-container">
      <button className="back-btn" onClick={() => navigate('/')}>
        ← Back to Dashboard
      </button>

      {/* Header Info */}
      <div className="entity-header-banner">
        <span className="subtitle">INDIVIDUAL CREDIT ASSESSMENT</span>
        <h1>{entity?.entity_name}</h1>
        <p className="entity-meta">{entity?.entity_id} • {entity?.sector} • {entity?.country}</p>
      </div>

      {/* Final credit decision */}
      <div className="panel-card">
        <div className="panel-header">
          <span className="section-label">FINAL CREDIT DECISION</span>
          <div className="header-flex">
            <h2>Final Risk</h2>
            <span className={`badge badge-${String(finalEvaluation).toLowerCase()}`}>
              {finalEvaluation} Risk
            </span>
            <div className={`decision-status status-${decisionStatus.toLowerCase().replace(/\s+/g, '-')}`}><span />{decisionStatus}</div>
          </div>
        </div>

        <div className="dual-grid">
          {/* Rule factor counts: intentionally not collapsed into a separate risk label */}
          <div className="assessment-col">
            <span className="col-label">Rule Assessment</span>
            <div className="rule-counts-line">
              <span className="rule-count-high">{ruleCounts.high} High</span><b>•</b>
              <span className="rule-count-medium">{ruleCounts.medium} Medium</span><b>•</b>
              <span className="rule-count-low">{ruleCounts.low} Low</span>
            </div>
            <p className="caption-text">Individual factor ratings from the configured rules.</p>
          </div>

          {/* ML Prediction Column */}
          <div className="assessment-col">
            <span className="col-label">ML Prediction</span>
            <h3 className={`risk-text risk-${mlRisk.toLowerCase()}`}>
              {mlRisk} risk
            </h3>
            <p className="caption-text">
              Decision Tree prediction. Rule assessment: <strong>{ruleFlagsLabel}</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Factors that need analyst attention */}
      <div className="panel-card">
        <span className="section-label">RISK FACTORS REQUIRING ATTENTION</span>
        <h2>Factors for review</h2>
        <div className="risk-factor-list">
          <div className="risk-factor-heading"><span className="caption-text">Medium- and high-rated factors flagged by the rules.</span><span>{riskFactors.length} factors</span></div>
          {riskFactors.length ? riskFactors.map(({ factor, evaluation: rating }) => (
            <div className="risk-factor-item" key={factor}>
              <span>{formatFactorName(factor)}</span>
              <span className={`badge badge-${String(rating).toLowerCase()}`}>{rating}</span>
            </div>
          )) : <p className="caption-text">No medium or high factors were flagged by the rules.</p>}
        </div>
      </div>

      {/* Card 3: Factor-by-Factor 2-Column Grid */}
      <div className="panel-card">
        <span className="section-label">BENCHMARK REVIEW</span>
        <h2>Factor-by-factor results</h2>
        <p className="caption-text">
          Each available parameter is rated using its configured threshold rule.
        </p>

        <div className="factors-2col-grid">
          {evaluation?.factor_evaluations &&
            Object.entries(evaluation.factor_evaluations).map(([factorKey, evalRating]) => {
              const rawValue = entity?.[factorKey] ?? 'N/A';
              const rating = typeof evalRating === 'string' ? evalRating : 'Not rated';

              return (
                <div key={factorKey} className="factor-row-card">
                  <div className="factor-info">
                    <span className="factor-title">{formatFactorName(factorKey)}</span>
                  </div>
                  <div className="factor-right">
                    <span className="raw-val">{String(rawValue)}</span>
                    <span className={`badge ${['Low', 'Medium', 'High'].includes(rating) ? `badge-${rating.toLowerCase()}` : 'badge-neutral'}`}>
                      {rating}{rating !== 'Not rated' ? ' risk' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
