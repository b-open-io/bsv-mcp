/**
 * Render the local migration page. This is intentionally dependency-free so
 * the setup link can work before the dashboard bundle or Vault adapter exists.
 */
export function renderVaultMigrationPage(
	options: { backendAvailable?: boolean; nonce?: string } = {},
) {
	const backendAvailable = options.backendAvailable === true;
	const nonce = (options.nonce ?? "vault-migration").replace(
		/[^A-Za-z0-9+/=_-]/g,
		"",
	);
	const initialBackend = JSON.stringify({
		available: backendAvailable,
		reason: backendAvailable
			? undefined
			: "Vault migration is unavailable until the local Vault backend is enabled.",
	});
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>BSV MCP Vault migration</title>
<style nonce="${nonce}">
:root{color-scheme:light dark;font:16px system-ui,sans-serif;line-height:1.45}body{margin:0;background:#f7f8fa;color:#17202a}main{max-width:760px;margin:0 auto;padding:2rem 1rem 4rem}section{background:#fff;border:1px solid #d8dee8;border-radius:10px;margin:1rem 0;padding:1rem 1.25rem}h1{font-size:1.7rem;margin-top:0}h2{font-size:1.1rem;margin-top:0}label{display:block;margin:.75rem 0}input,button{font:inherit;padding:.55rem .65rem;border-radius:6px;border:1px solid #9ca8b8}input{display:block;box-sizing:border-box;width:100%;margin-top:.3rem}button{background:#175cd3;color:white;border-color:#175cd3;cursor:pointer;margin:.4rem .4rem .4rem 0}button[disabled]{background:#aab4c3;border-color:#aab4c3;cursor:not-allowed}button.secondary{background:transparent;color:#17202a;border-color:#9ca8b8}.notice{padding:.7rem .8rem;border-radius:6px;background:#eef4ff}.warning{background:#fff4d6}.error{background:#ffe9e9;color:#8b1e1e}.success{background:#e8f7ed;color:#155d2d}.muted{color:#536273;font-size:.92rem}.source{display:flex;justify-content:space-between;align-items:center;gap:1rem;border-top:1px solid #e5e9ef;padding:.7rem 0}.source:first-child{border-top:0}.source button{margin:0}.hidden{display:none}pre{white-space:pre-wrap;word-break:break-word;background:#f1f3f6;padding:.75rem;border-radius:6px;font-size:.85rem}@media(prefers-color-scheme:dark){body{background:#11161c;color:#eef2f6}section{background:#1b232d;border-color:#394655}input,.secondary{background:#11161c;color:#eef2f6}pre{background:#11161c}.notice{background:#1b365f}.warning{background:#4b3b16}.error{background:#4b1e1e}.success{background:#163b24}}
</style>
</head>
<body>
<main>
<h1>Move an existing identity into local Vault</h1>
<p class="muted">This page runs on your computer. It lists filenames first, unlocks only through the local Vault backend, and keeps the passphrase in memory for the unlock request.</p>
<div id="status" class="notice" role="status">Inspecting local setup…</div>
<section aria-labelledby="inventory-heading"><h2 id="inventory-heading">1. Review local sources</h2><div id="sources">No source selected.</div><p id="inventory-note" class="muted">Only filenames and presence flags are shown. Key values and database contents are not sent to this page.</p></section>
<section aria-labelledby="destination-heading"><h2 id="destination-heading">2. Choose a Vault destination</h2><form id="destination-form">
<label>Account name<input id="account-name" name="accountName" autocomplete="off" pattern="[a-z0-9][a-z0-9_-]{0,63}" required></label>
<label>Vault file path<input id="vault-path" name="vaultPath" autocomplete="off" required></label>
<label>Vault entry ID<input id="vault-entry-id" name="vaultEntryId" autocomplete="off" required></label>
<label>Expected public key (optional)<input id="expected-public-key" name="expectedPublicKey" autocomplete="off"></label>
<button id="choose-destination" type="submit" disabled>Use this destination</button>
</form></section>
<section aria-labelledby="unlock-heading"><h2 id="unlock-heading">3. Unlock locally and preview</h2><div id="backend-state" class="warning" role="alert">Checking Vault migration support…</div><form id="unlock-form">
<label>Source backup passphrase (leave blank for plaintext sources)<input id="source-secret" name="sourcePassphrase" type="password" autocomplete="current-password"></label>
<label>Destination Vault passphrase (needed for a new or locked Vault)<input id="destination-secret" name="destinationPassphrase" type="password" autocomplete="new-password"></label>
<button id="unlock" type="submit" disabled>Unlock locally</button><button id="lock" type="button" class="secondary" disabled>Lock session</button>
</form><p class="muted">The passphrase is sent only to this local setup server, is never displayed in status text, and is cleared after the request.</p></section>
<section id="preview-section" class="hidden" aria-labelledby="preview-heading"><h2 id="preview-heading">4. Verify preservation</h2><div id="preview-status" role="status"></div><pre id="preview-data"></pre><div id="project-roles"></div><div id="conflicts"></div><label>Type <strong>MIGRATE_AND_SWITCH</strong> to authorize the cutover<input id="confirmation" autocomplete="off" disabled></label><button id="cutover" type="button" disabled>Import and switch to Vault</button><button id="retry" type="button" class="secondary hidden">Retry preview</button></section>
<section id="progress-section" class="hidden" aria-labelledby="progress-heading"><h2 id="progress-heading">Migration progress</h2><div id="progress" role="status"></div></section>
<section id="recovery-section" class="hidden" aria-labelledby="recovery-heading"><h2 id="recovery-heading">Recovery</h2><div id="recovery" role="alert"></div><button id="recover" type="button">Unlock again</button></section>
<p class="muted">Migration is not yet enabled in this preview unless the local Vault backend reports ready. No source is erased and the running wallet is not switched until the explicit cutover completes and verifies.</p>
</main>
<script nonce="${nonce}">
(() => {
 const token = location.hash.slice(1); history.replaceState(null, '', '/');
 const initialBackend = ${initialBackend};
 const projectRoles = ['identity-signing', 'payments', 'one-sat', 'encryption'];
 const projectRoleLabels = {'identity-signing':'Identity signing', payments:'Payments', 'one-sat':'OneSat assets', encryption:'Encryption'};
 let backend = initialBackend, inventory, source, destination, session, preview, state = 'inventory', recoveryNoEffect = false, selectedRoleChoices = {};
 const $ = id => document.getElementById(id);
 const setText = (id, value) => { $(id).textContent = value; };
 const show = (id, visible) => $(id).classList.toggle('hidden', !visible);
 const auth = {Authorization: 'Bearer ' + token};
 async function api(path, options = {}) {
  const response = await fetch(path, {...options, headers: {...auth, ...(options.headers || {}), ...(options.body ? {'Content-Type':'application/json'} : {})}});
  let data = null; try { data = await response.json(); } catch {}
  if (!response.ok) { const failure = new Error(data && data.error ? data.error : 'Local setup request failed'); failure.noEffect = data && data.noEffect === true; throw failure; }
  return data;
 }
 function setBackend(value) {
  backend = value && value.available === true ? value : {available:false, reason:(value && value.reason) || 'Vault migration is unavailable until the local Vault backend is enabled.'};
  setText('backend-state', backend.available ? 'Vault migration backend is ready. Unlock stays on this device.' : backend.reason);
  $('backend-state').className = backend.available ? 'notice' : 'warning';
  $('choose-destination').disabled = !source;
  $('unlock').disabled = !backend.available || !destination;
 }
 function renderSources() {
  const host = $('sources'); host.replaceChildren();
  if (!inventory.sources.length) { host.textContent = 'No eligible legacy source files were found.'; return; }
  for (const item of inventory.sources) {
   const row = document.createElement('div'); row.className = 'source';
   const text = document.createElement('span'); text.textContent = item.account + ' (' + item.location + ') — ' + [item.encryptedBackup && 'encrypted backup', item.plaintextKeys && 'plaintext keys', item.walletDatabases.length && item.walletDatabases.length + ' database(s)'].filter(Boolean).join(', '); row.append(text);
   const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Select'; button.addEventListener('click', () => { source = item; destination = undefined; selectedRoleChoices = {}; $('destination-form').reset(); $('unlock').disabled = true; setText('status', 'Source selected: ' + item.account + '. Choose a Vault destination.'); $('choose-destination').disabled = false; }); row.append(button); host.append(row);
  }
 }
 function showFailure(error) { const message = error && error.message ? error.message : 'Local setup request failed'; recoveryNoEffect = Boolean(error && error.noEffect === true); setText('status', message); $('status').className = 'error'; show('recovery-section', true); setText('recovery', recoveryNoEffect ? message + ' No destination write or source change was reported; retry the preview when ready.' : message); $('recover').textContent = recoveryNoEffect ? 'Retry preview' : 'Reconcile cutover'; }
 $('destination-form').addEventListener('submit', event => { event.preventDefault(); if (!source) return; destination = {accountName:$('account-name').value, vaultPath:$('vault-path').value, vaultEntryId:$('vault-entry-id').value, expectedPublicKey:$('expected-public-key').value || undefined}; $('unlock').disabled = !backend.available; setText('status', 'Destination selected. Unlock the Vault locally to preview preservation.'); });
 $('unlock-form').addEventListener('submit', async event => { event.preventDefault(); if (!backend.available || !source || !destination) return; const sourceInput = $('source-secret'); const destinationInput = $('destination-secret'); const sourcePassphrase = sourceInput.value; const destinationPassphrase = destinationInput.value; sourceInput.value = ''; destinationInput.value = ''; $('unlock').disabled = true; setText('status', 'Unlocking locally…'); try { const data = await api('/api/migration/unlock', {method:'POST', body:JSON.stringify({source, destination, sourcePassphrase, destinationPassphrase: destinationPassphrase || undefined})}); session = data.session; preview = data.preview; $('lock').disabled = false; renderPreview(); setText('status', 'Preview ready. Review identity, addresses, databases, and existing Vault entries before cutover.'); } catch (error) { showFailure(error); } finally { sourceInput.value = ''; destinationInput.value = ''; $('unlock').disabled = !backend.available || !destination; } });
 $('lock').addEventListener('click', async () => { try { if (session) await api('/api/migration/lock', {method:'POST', body:JSON.stringify({sessionId:session.sessionId})}); session = undefined; preview = undefined; selectedRoleChoices = {}; show('preview-section', false); setText('status', 'Vault session locked. Unlock again locally to continue.'); } catch (error) { showFailure(error); } });
 function renderRoleSelection() {
  const host = $('project-roles'); host.replaceChildren();
  const roles = preview && preview.projectRoles;
  if (!roles) { show('project-roles', false); return; }
  show('project-roles', true);
  const heading = document.createElement('h3'); heading.textContent = 'Choose project key roles'; host.append(heading);
  const note = document.createElement('p'); note.className = 'muted'; note.textContent = 'Choose a verified candidate or leave each role unassigned. Only candidate IDs are sent when you continue.'; host.append(note);
  const current = roles.current && roles.current.current ? roles.current.current : {};
  for (const role of projectRoles) {
   const fieldset = document.createElement('fieldset');
   const legend = document.createElement('legend'); legend.textContent = projectRoleLabels[role]; fieldset.append(legend);
   const label = document.createElement('label'); label.textContent = 'Key for ' + projectRoleLabels[role];
   const select = document.createElement('select'); select.dataset.projectRole = role;
   const selected = current[role] ? 'keep:' + current[role] : 'unassigned';
   const keep = document.createElement('option'); keep.value = selected; keep.textContent = current[role] ? 'Keep current selection' : 'Unassigned'; select.append(keep);
   if (current[role]) { const clear = document.createElement('option'); clear.value = 'unassigned'; clear.textContent = 'Unassigned'; select.append(clear); }
   for (const candidate of roles.candidates) {
    const option = document.createElement('option'); option.value = 'select:' + candidate.candidateId; option.textContent = candidate.label + (candidate.publicDerivationLabel ? ' (' + candidate.publicDerivationLabel + ')' : '') + (candidate.unavailableReason ? ' — ' + candidate.unavailableReason : ''); option.disabled = Boolean(candidate.unavailableReason) || !candidate.supportedRoles.includes(role); select.append(option);
   }
   if (selectedRoleChoices[role]) select.value = selectedRoleChoices[role]; else select.value = selected;
   select.addEventListener('change', () => { selectedRoleChoices[role] = select.value; updateCutoverButton(); }); label.append(select); fieldset.append(label); host.append(fieldset);
  }
  updateCutoverButton();
 }
 function roleSelection() {
  const roles = preview && preview.projectRoles; if (!roles) return undefined;
  const assignments = {}; for (const role of projectRoles) { const select = document.querySelector('[data-project-role="' + role + '"]'); if (!select || !select.value) return undefined; assignments[role] = select.value; }
  return {expectedProjectId: roles.projectId, expectedRevision: roles.current ? roles.current.revision : null, roleAssignments: assignments};
 }
 function updateCutoverButton() { $('cutover').disabled = $('confirmation').value !== 'MIGRATE_AND_SWITCH' || preview.conflicts.some(conflict => !conflict.resolution) || Boolean(preview.projectRoles && !roleSelection()); }
 function renderPreview() { show('preview-section', true); $('confirmation').disabled = false; const safe = {source:preview.source, destination:preview.destination, preservation:preview.preservation, conflicts:preview.conflicts}; $('preview-data').textContent = JSON.stringify(safe, null, 2); renderRoleSelection(); const conflicts = $('conflicts'); conflicts.replaceChildren(); if (preview.conflicts.length) { const note = document.createElement('p'); note.className = 'warning'; note.textContent = 'Resolve every existing Vault conflict before cutover.'; conflicts.append(note); for (const conflict of preview.conflicts) { const row = document.createElement('label'); row.textContent = conflict.message; const select = document.createElement('select'); select.innerHTML = '<option value="">Choose a resolution</option><option value="keep-existing">Keep existing Vault entry</option><option value="import-source">Import source material</option><option value="skip">Skip this item</option>'; select.value = conflict.resolution || ''; select.addEventListener('change', async () => { try { const data = await api('/api/migration/resolve', {method:'POST', body:JSON.stringify({sessionId:session && session.sessionId, conflictId:conflict.id, resolution:select.value})}); preview = data.preview; renderPreview(); } catch (error) { showFailure(error); } }); row.append(select); conflicts.append(row); } } else { conflicts.textContent = 'No conflicts reported.'; } $('confirmation').oninput = updateCutoverButton; updateCutoverButton(); }
 $('cutover').addEventListener('click', async () => { const selectedRoles = roleSelection(); if ($('confirmation').value !== 'MIGRATE_AND_SWITCH' || !session || (preview.projectRoles && !selectedRoles)) return; $('cutover').disabled = true; show('progress-section', true); setText('progress', 'Preparing a recoverable backup…'); try { const data = await api('/api/migration/cutover', {method:'POST', body:JSON.stringify({sessionId:session.sessionId, confirmation:'MIGRATE_AND_SWITCH', ...(selectedRoles ? {roleSelection:selectedRoles} : {})})}); setText('progress', 'Migration verified. Account ' + data.accountName + ' is ready in Vault.'); $('progress-section').className = 'success'; setText('status', 'Vault cutover complete.'); show('recovery-section', false); } catch (error) { showFailure(error); $('cutover').disabled = false; } });
 $('retry').addEventListener('click', async () => { try { const data = await api('/api/migration/preview', {method:'POST', body:JSON.stringify({sessionId:session && session.sessionId})}); preview = data.preview; renderPreview(); } catch (error) { showFailure(error); } });
 $('recover').addEventListener('click', async () => { if (recoveryNoEffect) { try { const data = await api('/api/migration/preview', {method:'POST', body:JSON.stringify({sessionId:session && session.sessionId})}); preview = data.preview; recoveryNoEffect = false; show('recovery-section', false); renderPreview(); setText('status', 'Preview refreshed. Review it before trying the cutover again.'); } catch (error) { showFailure(error); } return; } if (!session) { $('source-secret').focus(); return; } try { const data = await api('/api/migration/reconcile', {method:'POST', body:JSON.stringify({sessionId:session.sessionId})}); if (data.phase === 'destination') { session = undefined; preview = undefined; show('preview-section', false); setText('status', 'Backend confirmed the source is safe to retry. Unlock again locally.'); } else if (data.phase === 'complete') { setText('status', 'Vault cutover complete and verified.'); show('recovery-section', false); } else { setText('recovery', 'Cutover status is still unknown. Keep the source and backup until the backend can reconcile it.'); } } catch (error) { showFailure(error); } });
 (async () => { try { inventory = await api('/api/inventory'); renderSources(); setText('status', inventory.migrationRequired ? 'Existing local sources found. Select one to begin.' : 'No existing key sources found.'); const capabilities = await api('/api/migration/capabilities'); setBackend(capabilities); } catch (error) { showFailure(error); } })();
})();
</script>
</body>
</html>`;
}
