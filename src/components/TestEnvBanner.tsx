const TestEnvBanner = () => {
  return (
    <div className="w-full bg-destructive text-destructive-foreground px-4 py-2 text-center text-sm font-body flex flex-col sm:flex-row items-center justify-center gap-2 z-50">
      <span>⚠️ Esto es un entorno de pruebas, por favor redirígete a</span>
      <a
        href="https://pizzeriaslozio.com"
        className="inline-flex items-center px-3 py-1 rounded-md bg-background text-foreground font-semibold hover:bg-background/90 transition-colors"
      >
        pizzeriaslozio.com
      </a>
    </div>
  );
};

export default TestEnvBanner;
