import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <Link to="/" className="logo-text" style={{ color: "white" }}>
              RED<span style={{ color: "var(--primary)" }}>hope</span>
            </Link>
            <p style={{ marginTop: 20 }}>
              REDhope ensures lifesaving blood reaches those in need. Join us — your
              donation saves lives.
            </p>
            <div className="social-links" aria-label="Social media">
              <a href="#" aria-label="Facebook"><i className="fab fa-facebook-f" /></a>
              <a href="#" aria-label="Twitter"><i className="fab fa-twitter" /></a>
              <a href="#" aria-label="Instagram"><i className="fab fa-instagram" /></a>
              <a href="#" aria-label="LinkedIn"><i className="fab fa-linkedin-in" /></a>
              <a href="#" aria-label="YouTube"><i className="fab fa-youtube" /></a>
            </div>
          </div>

          <div className="footer-col">
            <h3>Quick Links</h3>
            <ul className="footer-links">
              <li><Link to="/"><i className="fas fa-chevron-right" /> Home</Link></li>
              <li><Link to="/camps"><i className="fas fa-chevron-right" /> Blood Donation Camps</Link></li>
              <li><Link to="/about"><i className="fas fa-chevron-right" /> About Us</Link></li>
              <li><Link to="/stories"><i className="fas fa-chevron-right" /> Stories</Link></li>
              <li><Link to="/donate"><i className="fas fa-chevron-right" /> Donate Blood</Link></li>
              <li><Link to="/organize"><i className="fas fa-chevron-right" /> Organize a Camp</Link></li>
              <li><Link to="/contact"><i className="fas fa-chevron-right" /> Contact Us</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>Resources</h3>
            <ul className="footer-links">
              <li><a href="#"><i className="fas fa-chevron-right" /> Blood Donation FAQs</a></li>
              <li><a href="#"><i className="fas fa-chevron-right" /> Eligibility Criteria</a></li>
              <li><a href="#"><i className="fas fa-chevron-right" /> Donation Process</a></li>
              <li><a href="#"><i className="fas fa-chevron-right" /> Blood Banks</a></li>
              <li><a href="#"><i className="fas fa-chevron-right" /> Health Tips</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>Contact Us</h3>
            <ul className="footer-links footer-contact">
              <li>
                <i className="fas fa-map-marker-alt" />
                <span>PARUL University, Vadodara, Gujarat, India</span>
              </li>
              <li>
                <i className="fas fa-phone" />
                <span>Helpline: +91 79845 10xxx</span>
              </li>
              <li>
                <i className="fas fa-envelope" />
                <span>info.redhope@gmail.com</span>
              </li>
              <li>
                <i className="fas fa-clock" />
                <span>Mon–Fri: 9 AM – 6 PM</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <p>
            &copy; {new Date().getFullYear()} REDhope. All Rights Reserved. |
            Designed with{" "}
            <i className="fas fa-heart" style={{ color: "var(--primary)" }} /> to
            save lives.
          </p>
        </div>
      </div>
    </footer>
  );
}
