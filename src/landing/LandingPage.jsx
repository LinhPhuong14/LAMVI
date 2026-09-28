import Header from './sections/Header.jsx'
import Hero from './sections/Hero.jsx'
import BrandStory from './sections/BrandStory.jsx'
import Collection from './sections/Collection.jsx'
import Heritage from './sections/Heritage.jsx'
import ArtworkStory from './sections/ArtworkStory.jsx'
import CuratorialCompanion from './sections/CuratorialCompanion.jsx'
import BespokeStudio from './sections/BespokeStudio.jsx'
import GiftingRitual from './sections/GiftingRitual.jsx'
import Inquiry from './sections/Inquiry.jsx'
import Footer from './sections/Footer.jsx'

export default function LandingPage() {
  return (
    <div className="bg-background text-on-surface antialiased">
      <Header />
      <main className="pt-20">
        <Hero />
        <BrandStory />
        <Collection />
        <Heritage />
        <ArtworkStory />
        <CuratorialCompanion />
        <BespokeStudio />
        <GiftingRitual />
        <Inquiry />
      </main>
      <Footer />
    </div>
  )
}
