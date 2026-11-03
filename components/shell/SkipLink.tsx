/** First focusable thing on every page (plan §4.1). Visible only while focused. */
export function SkipLink() {
  return (
    <a href="#content" className="btn btn-md btn-primary skip-link">
      Skip to content
    </a>
  );
}
