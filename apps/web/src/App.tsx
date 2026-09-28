import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

const API_URL = 'http://localhost:4000';

type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

type Sender = {
  id: string;
  name: string;
  email: string;
  maxEmailsPerHour: number;
  minDelayMs: number;
};

type Campaign = {
  id: string;
  name: string;
  subject: string;
  totalEmails: number;
  status: string;
  startAt: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    email: string;
  };
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [search, setSearch] = useState('');

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderId, setSenderId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [delayMs, setDelayMs] = useState('2000');
  const [hourlyLimit, setHourlyLimit] = useState('200');
  const [recipients, setRecipients] = useState('');
  const [csvName, setCsvName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [meResponse, campaignResponse, senderResponse] =
        await Promise.all([
          fetch(`${API_URL}/auth/me`, {
            credentials: 'include',
          }),
          fetch(`${API_URL}/campaigns`, {
            credentials: 'include',
          }),
          fetch(`${API_URL}/senders`, {
            credentials: 'include',
          }),
        ]);

      if (meResponse.ok) {
        const me = await meResponse.json();
        setUser(me.user);
      }

      if (campaignResponse.ok) {
        const data = await campaignResponse.json();
        setCampaigns(data.campaigns ?? []);
      }

      if (senderResponse.ok) {
        const data = await senderResponse.json();
        setSenders(data.senders ?? []);

        if (data.senders?.length > 0) {
          setSenderId(data.senders[0].id);
          setHourlyLimit(String(data.senders[0].maxEmailsPerHour));
          setDelayMs(String(data.senders[0].minDelayMs));
        }
      }
    } catch {
      setMessage('Unable to connect to the API.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    window.location.reload();
  }

  function handleCsvUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setCsvName(file.name);

    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result ?? '');

      const emails = text
        .split(/\r?\n/)
        .flatMap((line) => line.split(','))
        .map((value) => value.trim())
        .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));

      setRecipients(emails.join('\n'));
    };

    reader.readAsText(file);
  }

  async function handleCreateCampaign(event: FormEvent) {
    event.preventDefault();

    const recipientList = recipients
      .split(/[\n,;]+/)
      .map((email) => email.trim())
      .filter(Boolean);

    if (!name || !subject || !body || !senderId || !startAt) {
      setMessage('Please fill in all required fields.');
      return;
    }

    if (recipientList.length === 0) {
      setMessage('Add at least one recipient.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/campaigns`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          subject,
          body,
          senderId,
          startAt: new Date(startAt).toISOString(),
          delayMs: Number(delayMs),
          hourlyLimit: Number(hourlyLimit),
          recipients: recipientList,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create campaign');
      }

      setMessage(`Campaign created. ${data.scheduledEmails} emails scheduled.`);
      setShowCompose(false);

      setName('');
      setSubject('');
      setBody('');
      setRecipients('');
      setCsvName('');

      await loadDashboard();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Failed to create campaign',
      );
    } finally {
      setSaving(false);
    }
  }

  const scheduledCampaigns = useMemo(
    () =>
      campaigns.filter(
        (campaign) =>
          campaign.status === 'SCHEDULED' || campaign.status === 'RUNNING',
      ),
    [campaigns],
  );

  const sentCampaigns = useMemo(
    () =>
      campaigns.filter(
        (campaign) =>
          campaign.status === 'COMPLETED' || campaign.status === 'FAILED',
      ),
    [campaigns],
  );

  const visibleCampaigns = (
    activeTab === 'scheduled' ? scheduledCampaigns : sentCampaigns
  ).filter((campaign) =>
    `${campaign.name} ${campaign.subject} ${campaign.sender.email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const totalEmails = campaigns.reduce(
    (total, campaign) => total + campaign.totalEmails,
    0,
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm font-medium text-slate-500">
          Loading ReachInbox...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">
            R
          </div>
          <span className="text-lg font-bold tracking-tight">
            ReachInbox
          </span>
        </div>

        <nav className="space-y-1 p-4">
          <button className="flex w-full items-center gap-3 rounded-lg bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-900">
            <span>▣</span>
            Campaigns
          </button>

          <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-slate-500 hover:bg-slate-50">
            <span>◉</span>
            Senders
          </button>

          <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-slate-500 hover:bg-slate-50">
            <span>⚙</span>
            Settings
          </button>
        </nav>

        <div className="absolute bottom-0 w-full border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                className="h-9 w-9 rounded-full"
                alt=""
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-sm font-bold">
                {user?.name?.charAt(0)}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>

            <button
              onClick={handleLogout}
              className="text-xs font-medium text-slate-500 hover:text-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-5 sm:px-8">
            <div>
              <h1 className="text-lg font-bold">Campaigns</h1>
              <p className="text-xs text-slate-500">
                Manage your email outreach
              </p>
            </div>

            <button
              onClick={() => setShowCompose(true)}
              className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              + New Campaign
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-5 sm:p-8">
          {message && (
            <div className="mb-5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
              {message}
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Total campaigns</p>
              <p className="mt-2 text-3xl font-bold">{campaigns.length}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Scheduled</p>
              <p className="mt-2 text-3xl font-bold">
                {scheduledCampaigns.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Emails</p>
              <p className="mt-2 text-3xl font-bold">{totalEmails}</p>
            </div>
          </section>

          <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  onClick={() => setActiveTab('scheduled')}
                  className={`rounded-md px-4 py-2 text-sm font-semibold ${
                    activeTab === 'scheduled'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  Scheduled
                </button>

                <button
                  onClick={() => setActiveTab('sent')}
                  className={`rounded-md px-4 py-2 text-sm font-semibold ${
                    activeTab === 'sent'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  Sent
                </button>
              </div>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search campaigns..."
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400 sm:w-64"
              />
            </div>

            {visibleCampaigns.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
                  ✉
                </div>
                <h3 className="font-semibold">No campaigns yet</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Create your first campaign to start scheduling emails.
                </p>
                <button
                  onClick={() => setShowCompose(true)}
                  className="mt-5 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                >
                  Create Campaign
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-left">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr className="text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3">Campaign</th>
                      <th className="px-5 py-3">Sender</th>
                      <th className="px-5 py-3">Emails</th>
                      <th className="px-5 py-3">Start</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleCampaigns.map((campaign) => (
                      <tr
                        key={campaign.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold">{campaign.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {campaign.subject}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm">
                          {campaign.sender.email}
                        </td>

                        <td className="px-5 py-4 text-sm font-medium">
                          {campaign.totalEmails}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {new Date(campaign.startAt).toLocaleString()}
                        </td>

                        <td className="px-5 py-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                            {campaign.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold">Create Campaign</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Schedule an email campaign
                </p>
              </div>

              <button
                onClick={() => setShowCompose(false)}
                className="text-2xl text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-5 p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold">Campaign name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Product launch"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Sender</span>
                  <select
                    value={senderId}
                    onChange={(event) => setSenderId(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none"
                  >
                    {senders.map((sender) => (
                      <option key={sender.id} value={sender.id}>
                        {sender.name} — {sender.email}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold">Subject</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Quick question about your business"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold">Email body</span>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Write your email..."
                  rows={7}
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </label>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Recipients</span>

                  <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">
                    Upload CSV
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleCsvUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {csvName && (
                  <p className="mt-2 text-xs text-slate-500">
                    Loaded: {csvName}
                  </p>
                )}

                <textarea
                  value={recipients}
                  onChange={(event) => setRecipients(event.target.value)}
                  placeholder="recipient@example.com&#10;another@example.com"
                  rows={5}
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                />

                <p className="mt-1 text-xs text-slate-500">
                  One email per line, comma-separated, or upload a CSV.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-semibold">Start time</span>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(event) => setStartAt(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Delay (ms)</span>
                  <input
                    type="number"
                    min="0"
                    value={delayMs}
                    onChange={(event) => setDelayMs(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Hourly limit</span>
                  <input
                    type="number"
                    min="1"
                    value={hourlyLimit}
                    onChange={(event) => setHourlyLimit(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={() => setShowCompose(false)}
                  className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? 'Scheduling...' : 'Schedule Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;