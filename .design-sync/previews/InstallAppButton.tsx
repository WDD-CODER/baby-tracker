import { InstallAppButton } from 'baby-tracker';

// Renders one of three states from the PWA install hook. Outside a real install
// context (as here and in Claude Design) it shows the add-to-home-screen guidance
// card — the state most users see.
export const Default = () => (
  <div className="p-8 w-96" dir="rtl">
    <InstallAppButton />
  </div>
);
