/** Shared site footer — brand + WhatsApp support. */
export function AppFooter() {
  return (
    <footer className="app-footer">
      <p className="app-footer-brand">Built by Kumaresh Budhia | Powered by KWOS</p>
      <p className="app-footer-support">
        Support:{" "}
        <a
          href="https://wa.me/919825063208"
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp +91 98250 63208
        </a>
      </p>
    </footer>
  );
}
