(() => {
  const el = [...document.querySelectorAll("span")].find(
    (e) => e.textContent && e.textContent.includes("QR TICKET")
  );
  if (!el) return "not found";
  let n = el;
  const out = [];
  for (let i = 0; i < 7 && n; i++) {
    const r = n.getBoundingClientRect();
    const cls = (n.className || "").toString().slice(0, 50);
    out.push(
      `${n.tagName} h=${Math.round(r.height)} w=${Math.round(r.width)} disp=${getComputedStyle(n).display} overflow=${getComputedStyle(n).overflow} [${cls}]`
    );
    n = n.parentElement;
  }
  return out.join("\n");
})()
