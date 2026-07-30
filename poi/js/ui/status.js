const element = () => document.getElementById('status');

/** Single owner of the status region, so it can never be left permanently hidden. */
export function setStatus(text, { busy = false, error = false } = {}) {
  const node = element();
  if (!node) return;
  node.hidden = false;
  node.textContent = text;
  node.classList.toggle('is-busy', busy);
  node.classList.toggle('is-error', error);
  node.setAttribute('aria-busy', String(busy));
}

export function clearStatus() {
  const node = element();
  if (!node) return;
  node.hidden = true;
  node.textContent = '';
  node.classList.remove('is-busy', 'is-error');
  node.setAttribute('aria-busy', 'false');
}
