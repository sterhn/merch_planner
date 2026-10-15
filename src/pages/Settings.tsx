import { useState } from 'react'
import { Database, DownloadCloud, Loader2, LogOut, PackageMinus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSignOut } from '../hooks/useAuth'
import { SCHEMA_VERSION, useSaveSetting, useSchemaVersion, useSettings } from '../hooks/useSettings'
import { BACKUP_TABLES, backupFileName, makeBackup, OPTIONAL_TABLES, type Backup } from '../lib/backup'
import { backupDue } from '../lib/settings'
import { formatDate, parseCount } from '../lib/format'
import { saveFile } from '../lib/saveFile'
import { fetchAllPages } from '../lib/paging'
import { showToast } from '../lib/toast'
import { failureMessage } from '../lib/errorMessage'
import { haptic } from '../lib/haptics'
import Card from '../components/Card'
import PageHeader from '../components/PageHeader'
import { SETTINGS } from '../components/sections'
import { inputClass, PrimaryButton, SecondaryButton } from '../components/FormField'

function fetchAll(table: string): Promise<Record<string, unknown>[]> {
  // app_settings is keyed by `key`; every other table has an id.
  const key = table === 'app_settings' ? 'key' : 'id'
  return fetchAllPages(async (from, to) => {
    const { data, error } = await supabase.from(table).select('*').order(key).range(from, to)
    if (error) throw error
    return data as Record<string, unknown>[]
  })
}

export default function Settings() {
  const signOut = useSignOut()
  const { settings, isLoading } = useSettings()
  const { data: dbVersion } = useSchemaVersion()
  const saveSetting = useSaveSetting()
  const [busy, setBusy] = useState(false)
  const [now] = useState(() => new Date())
  // Draft of the threshold field; null while it mirrors the saved value.
  const [thresholdDraft, setThresholdDraft] = useState<string | null>(null)
  const threshold = thresholdDraft ?? String(settings.lowStockThreshold)

  async function downloadBackup() {
    haptic()
    setBusy(true)
    try {
      const tables: Backup['tables'] = {}
      for (const table of BACKUP_TABLES) {
        try {
          tables[table] = await fetchAll(table)
        } catch (err) {
          // app_settings only exists from migration 010 on.
          if (!OPTIONAL_TABLES.has(table)) throw err
        }
      }
      const now = new Date()
      const file = new File([JSON.stringify(makeBackup(tables, now), null, 1)], backupFileName(now), {
        type: 'application/json',
      })
      const result = await saveFile(file)
      if (result === 'cancelled') return
      saveSetting.mutate({ key: 'lastBackupAt', value: now.toISOString() })
      const count = Object.values(tables).reduce((s, rows) => s + (rows?.length ?? 0), 0)
      showToast(`Backup saved — ${count} rows`)
    } catch (err) {
      showToast(failureMessage('Backup', err))
    } finally {
      setBusy(false)
    }
  }

  function saveThreshold(e: React.FormEvent) {
    e.preventDefault()
    const value = parseCount(threshold, 0)
    if (value === null) return
    saveSetting.mutate(
      { key: 'lowStockThreshold', value },
      {
        onSuccess: () => {
          setThresholdDraft(null)
          showToast(`Low-stock alert set to ${value}`)
        },
      },
    )
  }

  const behind = dbVersion !== undefined && dbVersion < SCHEMA_VERSION

  return (
    <div>
      <PageHeader title="Settings" icon={SETTINGS.icon} tone={SETTINGS.tone} />

      <div className="space-y-3">
        <Card title="Backup">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[38%] bg-brand/15 text-brand" aria-hidden>
              <DownloadCloud size={19} />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold">
                Last backup:{' '}
                <span className={!isLoading && backupDue(settings.lastBackupAt, now) ? 'text-bad' : ''}>
                  {settings.lastBackupAt ? formatDate(settings.lastBackupAt) : 'never'}
                </span>
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Saves every order, item, collect and expense as one file. Keep it somewhere safe — Drive, or
                email it to yourself. Photos stay in Supabase storage and aren't included.
              </p>
            </div>
          </div>
          <PrimaryButton className="mt-3" onClick={() => void downloadBackup()} disabled={busy}>
            <span className="flex items-center justify-center gap-2">
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? 'Preparing backup…' : 'Download backup'}
            </span>
          </PrimaryButton>
        </Card>

        <Card title="Catalog">
          <form onSubmit={saveThreshold} className="flex items-end gap-3">
            <label className="block min-w-0 flex-1">
              <span className="mb-1.5 ml-1 flex items-center gap-1.5 text-xs font-bold text-ink-muted">
                <PackageMinus size={13} />
                "Running low" at this stock or below
              </span>
              <input
                className={inputClass}
                type="number"
                min={0}
                inputMode="numeric"
                value={threshold}
                onChange={(e) => setThresholdDraft(e.target.value)}
              />
            </label>
            <SecondaryButton
              type="submit"
              className="h-12 shrink-0"
              disabled={saveSetting.isPending || thresholdDraft === null}
            >
              Save
            </SecondaryButton>
          </form>
        </Card>

        <Card title="Database">
          <p className="flex items-center gap-2 text-sm">
            <Database size={15} className={behind ? 'text-bad' : 'text-ink-faint'} />
            {dbVersion === undefined
              ? 'Checking…'
              : behind
                ? `Version ${dbVersion} — this app needs ${SCHEMA_VERSION}`
                : `Up to date (version ${dbVersion})`}
          </p>
          {behind && (
            <p className="mt-1 text-xs text-ink-muted">
              Paste each file in supabase/migrations/ numbered above {String(dbVersion).padStart(3, '0')} into
              the Supabase SQL Editor and run it, then reload.
            </p>
          )}
        </Card>

        <SecondaryButton onClick={() => void signOut()} className="w-full">
          <LogOut size={16} />
          Sign out
        </SecondaryButton>
      </div>
    </div>
  )
}
