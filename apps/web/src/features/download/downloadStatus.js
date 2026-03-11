let statusInterval = null;

export function showStatus(messages) {
  const el = document.getElementById("videoLoading");
  if (!el) return () => {};

  let index = 0;

  el.classList.remove("hidden");
  el.textContent = messages[index];

  if (statusInterval) clearInterval(statusInterval);

  statusInterval = setInterval(() => {
    index = (index + 1) % messages.length;
    el.textContent = messages[index];
  }, 900);

  return () => {
    clearInterval(statusInterval);
    statusInterval = null;
    el.classList.add("hidden");
  };
}