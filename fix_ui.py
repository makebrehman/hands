import sys

file_path = r'src\sidepanel.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target_ui = '''        {showSettings && (
          <div className="hands-settings" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="hands-setting-group">
              <label>Model</label>
              <select value={chatModel} onChange={(e) => handleChatModelChange(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)' }}>
                {CHAT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="hands-setting-group">
              <label>Custom API Key (BYOK)</label>
              <input 
                type="password" 
                value={apiKey} 
                onChange={(e) => setApiKey(e.target.value)} 
                placeholder="Leave blank for Hands Cloud proxy" 
                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)' }} 
              />
            </div>

            <div className="hands-setting-group">
              <label>Custom Base URL</label>
              <input 
                type="text" 
                value={baseUrl} 
                onChange={(e) => setBaseUrl(e.target.value)} 
                placeholder="https://openrouter.ai/api/v1/chat/completions" 
                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)' }} 
              />
            </div>'''

replace_ui = '''        {showSettings && (
          <div className="hands-settings" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontWeight: 'bold' }}>Use Custom Provider</label>
              <label className="hands-switch">
                <input type="checkbox" checked={useCustomProvider} onChange={(e) => setUseCustomProvider(e.target.checked)} />
                <span className="hands-slider"></span>
              </label>
            </div>

            {useCustomProvider ? (
              <>
                <div className="hands-setting-group">
                  <label>Custom API Key (BYOK)</label>
                  <input 
                    type="password" 
                    value={apiKey} 
                    onChange={(e) => setApiKey(e.target.value)} 
                    placeholder="Enter your API Key" 
                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)' }} 
                  />
                </div>

                <div className="hands-setting-group">
                  <label>Custom Base URL</label>
                  <input 
                    type="text" 
                    value={baseUrl} 
                    onChange={(e) => setBaseUrl(e.target.value)} 
                    placeholder="e.g. https://api.groq.com/openai/v1/chat/completions" 
                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)' }} 
                  />
                </div>
                
                <div className="hands-setting-group">
                  <label>Custom Model ID</label>
                  <input 
                    type="text" 
                    value={customModel} 
                    onChange={(e) => setCustomModel(e.target.value)} 
                    placeholder="e.g. llama3-70b-8192" 
                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)' }} 
                  />
                </div>
              </>
            ) : (
              <div style={{ padding: '8px', background: 'var(--bg-2)', borderRadius: '4px', fontSize: '13px', color: 'var(--text)' }}>
                Currently using the secure <strong>Hands Cloud</strong> provider.
              </div>
            )}'''

content = content.replace(target_ui, replace_ui)

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
