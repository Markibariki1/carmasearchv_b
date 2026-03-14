import Link from 'next/link';

export default function ErrorPage() {
  return (
    <div className="theme-b min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
        <p className="text-muted-foreground mb-6">There was an issue with your authentication. Please try again.</p>
        <Link
          href="/login"
          className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
