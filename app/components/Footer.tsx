import '../styles/footer.css'

const footerLinks = ['Términos', 'Privacidad', 'Ayuda', 'Contacto']

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span className="footer-brand">Talentia</span>
        <div className="footer-links">
          {footerLinks.map((link) => (
            <a key={link} href="#">{link}</a>
          ))}
        </div>
      </div>
      <p className="footer-copy">© 2026 Talentia. Todos los derechos reservados.</p>
    </footer>
  )
}