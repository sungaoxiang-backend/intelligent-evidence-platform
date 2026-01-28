
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { Footer } from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/20 selection:text-primary">
      <Header />
      <main>
        <Hero />
        <Features />
        {/* Placeholder for more sections if needed, e.g. Testimonials, Pricing, FAQ */}
      </main>
      <Footer />
    </div>
  );
}

export default App;
