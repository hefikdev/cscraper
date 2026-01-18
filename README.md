  # Shadow Market (Campsy.pl) — Google Index + Facebook Profile Scraper

System do masowego pozyskiwania leadów z publicznych wyników Google (Dorking) i fragmentów Facebooka. Dane trafiają do kwarantanny w `raw_leads`, gdzie następuje deduplikacja po `phone_normalized`.

## Wymagania
- Docker + Docker Compose
- Klucze API: SerpAPI (Google + Facebook Profile) i Gemini

## Konfiguracja
1. Skopiuj `.env.example` do `.env` i uzupełnij wartości (DATABASE_URL, SERPAPI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY)
2. Zbuduj i uruchom kontenery:
	 ```bash
	 docker compose up -d --build
	 ```
3. Aplikacja będzie dostępna pod adresem http://localhost:3000
4. PostgreSQL będzie dostępny pod adresem localhost:5432

## Uruchomienie aplikacji w produkcji
Aplikacja działa w trybie produkcyjnym wewnątrz kontenera Docker (Node.js Alpine).
- **Uruchomienie:** `docker compose up -d`
- **Zatrzymanie:** `docker compose down`
- **Logi:** `docker compose logs -f app`
- **Restart:** `docker compose restart app`

## Uruchomienie scrapera
Scraper korzysta z SerpAPI + Gemini i zapisuje dane do `raw_leads`.
Gdy wynik wskazuje na profil Facebooka, wykonywane jest dodatkowe zapytanie
`engine=facebook_profile` (SerpAPI) w celu wzbogacenia danych. W razie błędu
pipeline kontynuuje na podstawie danych z Google.

**Uwaga:** Scraper nie jest jeszcze zintegrowany z Dockerem - uruchamiaj go lokalnie po zainstalowaniu zależności (`npm install`):
- Dla jobu zapisanego w UI:
	```bash
	npm run scrape -- --jobId=1
	```
- Dla parametrów ręcznych:
	```bash
	npm run scrape -- --wojewodztwo=mazowieckie --city=Warszawa --campType=Półkolonie --category=jeździeckie
	```

## Ręczna kategoryzacja danych (UI)
Na stronie głównej w sekcji "Ostatnie leady" znajduje się przycisk
"Kategoryzuj dane" przy każdym leadzie. Po kliknięciu serwer wyśle fragment
tekstu do modelu Gemini, który zasugeruje poprawne `city` i `category`.
Zasugerowane zmiany są automatycznie zapisywane w `raw_leads` i wynik
wyświetlany jest w oknie dialogowym. 🧠🔧

## Zbiorcza kategoryzacja i weryfikacja
Dodano przycisk "Kategoryzuj wszystkie", który uruchamia AI na wszystkich
niedzakurowanych leadach. Dla każdego leada model Gemini:
- sugeruje `city` i `category` (może stworzyć nową kategorię/napisać nową wartość)
- sprawdza, czy organizator wydaje się realny (`verified`)
- jeśli zasugerowane wartości różnią się od istniejących, zostają zapisane
- lead zostaje oznaczony statusem `CATEGORIZED`, a jeśli weryfikacja wyszła
  pozytywnie, pole `verified` ustawione jest na `true`

Dzięki temu możesz szybko poprawić błędne kategorie i oznaczyć zweryfikowane
organizacje. 🔎✅

## Struktura danych
- Kwarantanna leadów: `raw_leads`
- Joby wyszukiwania: `search_jobs`
- Uruchomienia jobów: `search_job_runs`

## Zasady
- Brak automatyzacji przeglądarki (Puppeteer/Playwright/Selenium – zabronione)
- Brak logowania do Facebooka
- Dane zawsze przechodzą przez normalizację telefonu

## Bezpieczeństwo i zgodność
System używa tylko oficjalnych API (SerpAPI, Gemini) i treści publicznych.
