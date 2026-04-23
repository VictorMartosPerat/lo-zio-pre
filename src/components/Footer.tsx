import { useTranslation } from "react-i18next";
import { Instagram, Facebook } from "lucide-react";

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="bg-foreground py-12 md:py-16 px-4 pb-24 md:pb-16">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div>
            <h3 className="font-display text-3xl font-bold text-background mb-4">Lo Zio</h3>
            <p className="text-background/60 font-body leading-relaxed mb-6">{t("footer.description")}</p>
            <div className="flex gap-4">
              <a
                href="https://www.instagram.com/loziopizzeria"
                target="_blank"
                rel="noopener noreferrer"
                className="text-background/60 hover:text-primary transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://www.facebook.com/loziopizzeria"
                target="_blank"
                rel="noopener noreferrer"
                className="text-background/60 hover:text-primary transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>
          <div>
            <h4 className="font-display text-lg font-bold text-background mb-4">Lo Zio Tarragona</h4>
            <p className="text-background/60 font-body text-sm leading-relaxed">
              Carrer Reding 32, Tarragona
              <br />
              +34 687 605 647
              <br />
              {t("reservation.locationTarragona.hours")}
            </p>
          </div>
          <div>
            <h4 className="font-display text-lg font-bold text-background mb-4">Lo Zio Arrabassada</h4>
            <p className="text-background/60 font-body text-sm leading-relaxed">
              Carrer Joan Fuster 28, Tarragona
              <br />
              +34 682 239 035
              <br />
              {t("reservation.locationArrabassada.hours")}
            </p>
          </div>
          <div>
            <h4 className="font-display text-lg font-bold text-background mb-4">El Rincón de Lo Zio</h4>
            <p className="text-background/60 font-body text-sm leading-relaxed">
              Carrer dels Castellers 3, Tarragona
              <br />
              {t("footer.rinconHours")}
            </p>
          </div>
        </div>
        <div className="border-t border-background/20 pt-8 text-center space-y-2">
          <p className="text-background/40 font-body text-sm">
            {t("footer.copyright", { year: new Date().getFullYear() })}
          </p>
          <p className="text-background/30 font-body text-xs">
            Developed by{" "}
            <a
              href="https://paciotti.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors underline underline-offset-2"
            >
              Paciotti Dev
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
