import re

with open('src/sidepanel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the start of the return statement
new_start = '''  return (
    <div className="hands-root">
      {/* Onboarding Screen for New Users */}
      {!authToken && !useCustomProvider ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '24px', gap: '16px', background: 'var(--bg-1)' }}>
          <HandsLogo />
          <h2 style={{ color: 'var(--text)', margin: '8px 0 4px 0', fontSize: '20px' }}>Welcome to Hands</h2>
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '14px', marginBottom: '16px' }}>Choose how you want to power your AI agent.</p>
          
          <button 
            onClick={signInWithGoogle} 
            style={{ padding: '12px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', width: '100%', fontWeight: 'bold', fontSize: '14px' }}>
            Continue with Google
          </button>
          
          <button 
            onClick={() => { 
              setUseCustomProvider(true); 
              chrome.storage.local.set({ useCustomProvider: true });
              setIsSettingsOpen(true); 
            }} 
            style={{ padding: '12px 20px', background: 'var(--bg-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', width: '100%', fontWeight: 'bold', fontSize: '14px' }}>
            Continue with BYOK
          </button>
        </div>
      ) : (
      <>
        {/* Modals & Overlays */}'''

content = content.replace('  return (\n    <div className="hands-root">\n      {/* Modals & Overlays */}', new_start)

# Replace the end of the Sidepanel return statement
old_end = '''        </div>
      </div>
    )
  }'''

new_end = '''        </div>
      </div>
      </>
      )}
    </div>
  )
}'''

content = content.replace(old_end, new_end)

with open('src/sidepanel.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print('Success')
