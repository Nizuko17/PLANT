import FadeIn from '@/components/FadeIn';
import Image from 'next/image';
import { Heart, Recycle, Lightbulb, User } from 'lucide-react';

export const metadata = {
  title: 'Chi Siamo | PLANT',
  description: 'Scopri la nostra storia, i valori e il team dietro a PLANT.',
};

export default function ChiSiamo() {
  return (
    <main>
      <section className="page-hero text-center">
        <div className="container">
          <FadeIn>
            <h1 className="hero-title">Chi siamo</h1>
            <p className="hero-subtitle">La nostra storia, la nostra visione.</p>
          </FadeIn>
        </div>
      </section>

      <section className="about-story">
        <div className="container">
          <div className="tech-grid">
            <FadeIn className="tech-image-wrapper">
              <Image src="/assets/hero.png" alt="Il team PLANT" width={600} height={600} layout="responsive" className="tech-img" />
            </FadeIn>
            <FadeIn className="tech-text">
              <h2>Un'idea nata dalla passione</h2>
              <p>PLANT nasce nel 2024 dall'unione di un team di ingegneri, designer e amanti della natura con un obiettivo chiaro: rendere la cura delle piante semplice, intelligente e accessibile a tutti.</p>
              <p>Crediamo che la tecnologia debba essere al servizio della natura, non contro di essa. Per questo ogni nostro prodotto è realizzato con materiali sostenibili e pensato per durare nel tempo.</p>
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="values-section bg-light">
        <div className="container text-center">
          <FadeIn>
            <h2>I nostri valori</h2>
          </FadeIn>
          <div className="mission-cards">
            <FadeIn className="mission-card">
              <Heart />
              <h4>Passione</h4>
              <p>Ogni prodotto nasce dalla passione per il design, la tecnologia e l'amore per la natura.</p>
            </FadeIn>
            <FadeIn className="mission-card">
              <Recycle />
              <h4>Sostenibilità</h4>
              <p>Materiali riciclati, packaging ridotto e un impegno concreto per il pianeta.</p>
            </FadeIn>
            <FadeIn className="mission-card">
              <Lightbulb />
              <h4>Innovazione</h4>
              <p>Ricerca continua per offrirti soluzioni sempre più intelligenti e all'avanguardia.</p>
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="team-section">
        <div className="container text-center">
          <FadeIn>
            <h2>Il nostro team</h2>
            <p>Un gruppo di professionisti uniti dalla stessa visione: portare la natura nelle case di tutti.</p>
          </FadeIn>
          <div className="team-grid">
            <FadeIn className="team-member">
              <div className="team-avatar"><User /></div>
              <h4>Marco Verdi</h4>
              <p>CEO & Fondatore</p>
            </FadeIn>
            <FadeIn className="team-member">
              <div className="team-avatar"><User /></div>
              <h4>Elena Bianchi</h4>
              <p>Head of Design</p>
            </FadeIn>
            <FadeIn className="team-member">
              <div className="team-avatar"><User /></div>
              <h4>Luca Rossi</h4>
              <p>Lead Engineer</p>
            </FadeIn>
          </div>
        </div>
      </section>
    </main>
  );
}
