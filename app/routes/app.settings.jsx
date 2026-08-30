export default function SettingsPage() {
  return (
    <s-page heading="Settings">
      <s-section heading="Google Drive">
        <s-stack gap="base">
          <s-text>
            Status: Not Connected
          </s-text>

          <s-button href="/google/connect">
  Connect Google Drive
</s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}