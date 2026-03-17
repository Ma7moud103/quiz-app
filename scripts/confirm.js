const overlay = document.createElement('div');
overlay.className = 'confirm-overlay';
overlay.innerHTML = `
  <div class="confirm-card">
    <h5 data-confirm-title>Confirm</h5>
    <p data-confirm-message>Are you sure you want to continue?</p>
    <div class="d-flex justify-content-end gap-2 mt-4">
      <button type="button" class="btn btn-outline-light" data-confirm-cancel>Cancel</button>
      <button type="button" class="btn btn-primary" data-confirm-accept>Yes</button>
    </div>
  </div>`
;

document.body.appendChild(overlay);

const titleEl = overlay.querySelector('[data-confirm-title]');
const messageEl = overlay.querySelector('[data-confirm-message]');
const acceptBtn = overlay.querySelector('[data-confirm-accept]');
const cancelBtn = overlay.querySelector('[data-confirm-cancel]');

let currentResolver;

function close(confirm) {
  if (!currentResolver) return;
  overlay.classList.remove('active');
  const resolver = currentResolver;
  currentResolver = null;
  resolver(confirm);
}

overlay.addEventListener('click', (event) => {
  if (event.target === overlay) {
    close(false);
  }
});

acceptBtn.addEventListener('click', () => close(true));
cancelBtn.addEventListener('click', () => close(false));

export function askConfirmation({
  title = 'Confirm',
  message = 'Are you sure you want to continue?',
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
} = {}) {
  if (currentResolver) {
    close(false);
  }
  titleEl.textContent = title;
  messageEl.textContent = message;
  acceptBtn.textContent = confirmLabel;
  cancelBtn.textContent = cancelLabel;
  overlay.classList.add('active');
  return new Promise((resolve) => {
    currentResolver = resolve;
  });
}
