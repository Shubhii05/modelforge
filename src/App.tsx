import React, { useState } from 'react'
import { TopBar } from './components/TopBar'
import { Sliders, Activity, Terminal, ChevronDown, ChevronUp, Sparkles, Database } from 'lucide-react'

export const App: React.FC = () => {
  const [showCode, setShowCode] = useState(true)
  const [transparencyMode, setTransparencyMode] = useState(true)
  const [activeTab, setActiveTab] = useState<'config' | 'results' | 'playground'>('config')

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-text select-none">
      {/* Top Header */}
      <TopBar
        showCode={showCode}
        transparencyMode={transparencyMode}
        onToggleCode={() => setShowCode(!showCode)}
        onToggleTransparency={() => setTransparencyMode(!transparencyMode)}
      />

      {/* Main 3-column + bottom layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Block Palette */}
        <aside className="w-64 border-r border-border bg-surface flex flex-col shrink-0">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider uppercase text-text-muted">
              Block Palette
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-active text-text-muted border border-border">
              Drag to Canvas
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Dataset Section */}
            <div>
              <div className="text-[11px] font-semibold text-text-muted mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-accent" />
                Data Source
              </div>
              <div className="p-2.5 rounded border border-border bg-surface-hover/70 hover:border-accent/40 cursor-grab text-xs flex flex-col gap-1 transition-colors">
                <div className="font-medium text-white flex items-center justify-between">
                  <span>Load Dataset</span>
                  <span className="w-2 h-2 rounded-full bg-accent" />
                </div>
                <p className="text-[11px] text-text-muted leading-tight">
                  Upload CSV or sample tabular dataset with auto-profiling
                </p>
              </div>
            </div>

            {/* Preprocessing Section */}
            <div>
              <div className="text-[11px] font-semibold text-text-muted mb-2 uppercase tracking-wide">
                Preprocessing
              </div>
              <div className="space-y-1.5">
                {[
                  { name: 'Handle Missing Values', desc: 'Impute median, mean, or constant' },
                  { name: 'Feature Scaling', desc: 'StandardScaler or MinMaxScaler' },
                  { name: 'Encode Categorical', desc: 'One-hot or ordinal encoding' },
                  { name: 'Outlier Removal', desc: 'IQR or Z-Score threshold filtering' },
                  { name: 'Custom Code', desc: 'AI-assisted scikit-learn transformer', ai: true },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="p-2 rounded border border-border bg-surface-hover/60 hover:border-border text-xs cursor-grab hover:bg-surface-active transition-colors"
                  >
                    <div className="font-medium text-text flex items-center justify-between">
                      <span>{item.name}</span>
                      {item.ai && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-accent/20 text-accent font-mono">
                          AI
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-muted leading-tight mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Model Section */}
            <div>
              <div className="text-[11px] font-semibold text-text-muted mb-2 uppercase tracking-wide">
                Model Training
              </div>
              <div className="space-y-1.5">
                {[
                  { name: 'Random Forest', desc: 'Ensemble bagging classifier' },
                  { name: 'XGBoost', desc: 'Gradient boosted decision trees' },
                  { name: 'Logistic Regression', desc: 'Linear decision boundary with L2/L1' },
                  { name: 'SVM (Support Vector)', desc: 'RBF / Linear kernel classifier' },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="p-2 rounded border border-border bg-surface-hover/60 hover:border-border text-xs cursor-grab hover:bg-surface-active transition-colors"
                  >
                    <div className="font-medium text-text">{item.name}</div>
                    <p className="text-[10px] text-text-muted leading-tight mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Output Section */}
            <div>
              <div className="text-[11px] font-semibold text-text-muted mb-2 uppercase tracking-wide">
                Evaluation & Output
              </div>
              <div className="p-2 rounded border border-border bg-surface-hover/60 hover:border-border text-xs cursor-grab hover:bg-surface-active transition-colors">
                <div className="font-medium text-text">Evaluate & Metrics</div>
                <p className="text-[10px] text-text-muted leading-tight mt-0.5">
                  Accuracy, confusion matrix, F1-score
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Center Canvas + Bottom Code Panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* React Flow Canvas Container */}
          <div className="flex-1 relative overflow-hidden bg-[#08090D] flex items-center justify-center border-r border-border">
            <div className="text-center p-6 rounded-lg border border-border bg-surface/50 max-w-sm">
              <Sparkles className="w-8 h-8 text-accent mx-auto mb-2 opacity-80" />
              <h3 className="text-sm font-semibold text-white mb-1">Canvas Ready</h3>
              <p className="text-xs text-text-muted">
                Pipeline execution graph initialized. In Phase 3, connect blocks visually to update the JSON spec.
              </p>
            </div>
          </div>

          {/* Bottom Synced Code Panel (conditionally shown via transparency switch & toggle) */}
          {transparencyMode && showCode && (
            <div className="h-48 border-t border-r border-border bg-surface flex flex-col shrink-0">
              <div className="h-8 border-b border-border px-3 flex items-center justify-between bg-surface-hover">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-accent" />
                  <span className="text-xs font-semibold font-mono text-white">
                    pipeline.py
                  </span>
                  <span className="text-[10px] font-mono px-1 rounded bg-surface border border-border text-text-muted">
                    Derived from spec • Read-only
                  </span>
                </div>
                <button
                  onClick={() => setShowCode(false)}
                  className="text-text-muted hover:text-text p-1"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 p-3 font-mono text-xs overflow-auto text-text-muted bg-[#080A0E]">
                <pre className="text-text">
{`# Generated live from JSON pipeline spec (Single Source of Truth)
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier

# Pipeline definition
pipeline = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler()),
    ('classifier', RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42))
])`}
                </pre>
              </div>
            </div>
          )}

          {transparencyMode && !showCode && (
            <div className="h-7 border-t border-r border-border bg-surface flex items-center justify-between px-3">
              <span className="text-[11px] font-mono text-text-muted flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-accent" />
                pipeline.py (collapsed)
              </span>
              <button
                onClick={() => setShowCode(true)}
                className="text-text-muted hover:text-text flex items-center gap-1 text-[11px]"
              >
                <span>Expand</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Config | Results tabs */}
        <aside className="w-80 border-border bg-surface flex flex-col shrink-0">
          {/* Tabs header */}
          <div className="h-10 border-b border-border flex items-center px-2 bg-surface">
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'config'
                  ? 'bg-surface-active text-white border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Config</span>
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'results'
                  ? 'bg-surface-active text-white border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Results</span>
            </button>
            <button
              onClick={() => setActiveTab('playground')}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === 'playground'
                  ? 'bg-surface-active text-white border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <span>Playground</span>
            </button>
          </div>

          {/* Right tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'config' && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-white uppercase tracking-wider">
                  Block Parameters
                </div>
                <div className="p-3 rounded border border-border bg-surface-hover/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white">Random Forest</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/30">
                      Configured
                    </span>
                  </div>

                  {transparencyMode && (
                    <div className="p-2 rounded bg-surface border border-border text-[11px] text-accent/90 italic">
                      Why these values: 100 trees balance generalization error with training time on tabular features.
                    </div>
                  )}

                  <div className="space-y-2 pt-1">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-text-muted">n_estimators</span>
                        <span className="font-mono text-accent">100</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="300"
                        defaultValue="100"
                        className="w-full accent-accent h-1.5 bg-surface-active rounded appearance-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-text-muted">max_depth</span>
                        <span className="font-mono text-accent">10</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        defaultValue="10"
                        className="w-full accent-accent h-1.5 bg-surface-active rounded appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'results' && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-white uppercase tracking-wider">
                  Pipeline Evaluation
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded border border-border bg-surface-hover/50">
                    <div className="text-[10px] text-text-muted uppercase">Accuracy</div>
                    <div className="text-lg font-mono font-semibold text-success">94.2%</div>
                  </div>
                  <div className="p-2.5 rounded border border-border bg-surface-hover/50">
                    <div className="text-[10px] text-text-muted uppercase">Precision</div>
                    <div className="text-lg font-mono font-semibold text-text">93.8%</div>
                  </div>
                  <div className="p-2.5 rounded border border-border bg-surface-hover/50">
                    <div className="text-[10px] text-text-muted uppercase">F1 Score</div>
                    <div className="text-lg font-mono font-semibold text-text">0.940</div>
                  </div>
                  <div className="p-2.5 rounded border border-border bg-surface-hover/50">
                    <div className="text-[10px] text-text-muted uppercase">Loss</div>
                    <div className="text-lg font-mono font-semibold text-text-muted">0.221</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'playground' && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-white uppercase tracking-wider">
                  Live Predictions
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Interactive inference endpoint. Enter sample values to test the trained model pipeline.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App
