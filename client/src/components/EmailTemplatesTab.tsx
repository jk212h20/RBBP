'use client';

import { useState, useEffect } from 'react';
import { adminAPI } from '@/lib/api';

interface EmailTemplate {
  id: string | null;
  type: string;
  subject: string;
  body: string;
  enabled: boolean;
  sendRules: Record<string, any> | null;
  updatedAt: string | null;
  isCustomized: boolean;
  variableHelp: string[];
  defaultSubject: string;
  defaultBody: string;
}

const TYPE_LABELS: Record<string, { label: string; description: string }> = {
  welcome: { label: '👋 Welcome', description: 'Sent when a new user registers' },
  event_signup: { label: '📅 Event Signup', description: 'Sent when a player signs up for a tournament' },
  event_reminder: { label: '🔔 Event Reminder', description: 'Sent the day before a tournament to registered players' },
  withdrawal_ready: { label: '⚡ Withdrawal Ready', description: 'Sent when sats are available to withdraw' },
  claim_link: { label: '🔗 Claim Link', description: 'Sent with a link for guest players to claim their account' },
};

export default function EmailTemplatesTab() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editSendRules, setEditSendRules] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await adminAPI.getEmailTemplates();
      setTemplates(data.templates);
      setEmailConfigured(data.emailConfigured);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function startEditing(template: EmailTemplate) {
    setEditingType(template.type);
    setEditSubject(template.subject);
    setEditBody(template.body);
    setEditEnabled(template.enabled);
    setEditSendRules(template.sendRules);
    setMessage(null);
  }

  function cancelEditing() {
    setEditingType(null);
    setMessage(null);
  }

  async function saveTemplate() {
    if (!editingType) return;
    setSaving(true);
    try {
      await adminAPI.updateEmailTemplate(editingType, {
        subject: editSubject,
        body: editBody,
        enabled: editEnabled,
        sendRules: editSendRules,
      });
      setMessage({ text: 'Template saved!', type: 'success' });
      setEditingType(null);
      await loadTemplates();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function resetTemplate(type: string) {
    if (!confirm('Reset this template to the default? Your customizations will be lost.')) return;
    try {
      await adminAPI.resetEmailTemplate(type);
      setMessage({ text: 'Template reset to default', type: 'success' });
      setEditingType(null);
      await loadTemplates();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  }

  async function toggleEnabled(template: EmailTemplate) {
    try {
      await adminAPI.updateEmailTemplate(template.type, { enabled: !template.enabled });
      await loadTemplates();
      setMessage({ text: `${TYPE_LABELS[template.type]?.label || template.type} ${!template.enabled ? 'enabled' : 'disabled'}`, type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  }

  async function handleSendTest(type: string) {
    if (!testEmail) {
      setMessage({ text: 'Enter an email address first', type: 'error' });
      return;
    }
    setSendingTest(type);
    try {
      const result = await adminAPI.sendTestEmail(type, testEmail);
      setMessage({ text: result.message, type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSendingTest(null);
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading email templates...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {!emailConfigured && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 text-yellow-300 text-sm">
          ⚠️ <strong>RESEND_API_KEY not configured</strong> — Email sending is disabled. Templates can be edited but emails won&apos;t be sent until the API key is set.
        </div>
      )}

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.type === 'success' ? 'bg-green-900/30 border border-green-700 text-green-300' : 'bg-red-900/30 border border-red-700 text-red-300'}`}>
          {message.text}
        </div>
      )}

      {/* Test email input */}
      <div className="bg-[#16213e] rounded-lg p-4 border border-[#0f3460]">
        <label className="block text-sm text-gray-400 mb-2">Test email address (for sending test emails)</label>
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full sm:w-80 px-3 py-2 bg-[#1a1a2e] border border-[#0f3460] rounded text-white text-sm"
        />
      </div>

      {/* Template list */}
      {templates.map((template) => {
        const info = TYPE_LABELS[template.type] || { label: template.type, description: '' };
        const isEditing = editingType === template.type;

        return (
          <div key={template.type} className="bg-[#16213e] rounded-lg border border-[#0f3460] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#0f3460]">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-semibold">{info.label}</h3>
                  {template.isCustomized && (
                    <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded">Customized</span>
                  )}
                  <button
                    onClick={() => toggleEnabled(template)}
                    className={`text-xs px-2 py-0.5 rounded ${template.enabled ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}
                  >
                    {template.enabled ? '✅ Enabled' : '❌ Disabled'}
                  </button>
                </div>
                <p className="text-sm text-gray-400 mt-1">{info.description}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSendTest(template.type)}
                  disabled={!!sendingTest || !testEmail || !emailConfigured}
                  className="text-xs px-3 py-1.5 bg-blue-600/30 text-blue-300 rounded hover:bg-blue-600/50 disabled:opacity-50"
                >
                  {sendingTest === template.type ? 'Sending...' : '📧 Test'}
                </button>
                {!isEditing && (
                  <button
                    onClick={() => startEditing(template)}
                    className="text-xs px-3 py-1.5 bg-[#0f3460] text-white rounded hover:bg-[#0f3460]/80"
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>
            </div>

            {/* Send Rules (for event_reminder) */}
            {template.type === 'event_reminder' && (
              <div className="px-4 py-3 bg-[#1a1a2e]/50 border-b border-[#0f3460]">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">⏰ Send reminder</span>
                  {isEditing ? (
                    <input
                      type="number"
                      min="1"
                      max="72"
                      value={editSendRules?.reminderHoursBefore ?? 24}
                      onChange={(e) => setEditSendRules({ ...editSendRules, reminderHoursBefore: parseInt(e.target.value) || 24 })}
                      className="w-16 px-2 py-1 bg-[#1a1a2e] border border-[#0f3460] rounded text-white text-sm text-center"
                    />
                  ) : (
                    <span className="text-white font-medium">{(template.sendRules as any)?.reminderHoursBefore ?? 24}</span>
                  )}
                  <span className="text-sm text-gray-400">hours before event</span>
                </div>
              </div>
            )}

            {/* Preview mode */}
            {!isEditing && (
              <div className="p-4">
                <div className="text-sm text-gray-400 mb-1">Subject:</div>
                <div className="text-white text-sm mb-3 font-mono bg-[#1a1a2e] p-2 rounded">{template.subject}</div>
                <div className="text-sm text-gray-400 mb-1">Available variables:</div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {template.variableHelp.map((v) => (
                    <code key={v} className="text-xs bg-[#1a1a2e] text-purple-300 px-1.5 py-0.5 rounded">{v}</code>
                  ))}
                </div>
              </div>
            )}

            {/* Edit mode */}
            {isEditing && (
              <div className="p-4 space-y-4">
                {/* Enabled toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editEnabled}
                    onChange={(e) => setEditEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-300">Send this email type</span>
                </label>

                {/* Subject */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Subject line</label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#0f3460] rounded text-white text-sm font-mono"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Email body (HTML — inner content only, wrapper is applied automatically)
                  </label>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 bg-[#1a1a2e] border border-[#0f3460] rounded text-white text-xs font-mono leading-relaxed"
                  />
                </div>

                {/* Variables help */}
                <div>
                  <div className="text-sm text-gray-400 mb-1">Available variables:</div>
                  <div className="flex flex-wrap gap-1">
                    {templates.find(t => t.type === editingType)?.variableHelp.map((v) => (
                      <code key={v} className="text-xs bg-[#1a1a2e] text-purple-300 px-1.5 py-0.5 rounded">{v}</code>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Use <code className="text-purple-300">{'{{button:Text:URL}}'}</code> for CTA buttons.
                    Use <code className="text-purple-300">{'{{#var}}...{{/var}}'}</code> for conditional sections.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveTemplate}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : '💾 Save Template'}
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-4 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  {template.isCustomized && (
                    <button
                      onClick={() => resetTemplate(template.type)}
                      className="px-4 py-2 bg-red-900/50 text-red-300 rounded text-sm hover:bg-red-900/70 ml-auto"
                    >
                      🔄 Reset to Default
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
