# AI Reviewer — plan rozwoju V1–V5

## Cel

Zbudować GitHub App, która analizuje Pull Requesty wraz z potrzebnym kontekstem, znajduje konkretne błędy i publikuje ograniczoną liczbę wartościowych uwag.

Projekt rozwijamy etapami: najpierw jakość analizy, następnie trwałość pracy agenta, automatyzacja, odporność na awarie i deployment. Każda wersja kończy się działającym scenariuszem.

**Aktualny etap:** V1.2 — pobranie snapshotu PR.

**Zakończone:** V1.1 — szkielet projektu i wejście CLI. Przyjęte jako zakończone na podstawie przeglądu kodu; programu, sprawdzania typów ani testów nie uruchamiano. README i opis konfiguracji sekretów świadomie odłożone do V1.5.

## Zasady wspólne

- TypeScript, Node.js 25, pnpm. Octokit do GitHuba, Zod do walidacji, Vitest do testów.
- Jeden model przez bibliotekę Pi; przed integracją sprawdzamy aktualne API i wybieramy konkretną wersję pakietu.
- Pi Durable dopiero w V2. Hono, GitHub App i SQLite dla zadań aplikacji dopiero w V3.
- Bez mikroserwisów, Redisa, osobnej infrastruktury kolejkowej, RAG i własnego dashboardu.
- Agent ma wyłącznie ograniczone narzędzia do odczytu repozytorium. Nie wykonuje kodu, nie uruchamia Basha i nie publikuje komentarzy.
- Treści PR, plików i komentarzy są niezaufanymi danymi, nie instrukcjami dla agenta.
- Sekrety pozostają poza promptami, wynikami narzędzi i logami.
- Analizujemy konkretny snapshot zmian, nie ruchomą nazwę brancha.
- Szukamy błędów i regresji, nie uwag o stylu. Maksymalnie pięć findings.
- Niepełna analiza musi być oznaczona jako niepełna; nie oznacza „PR bez błędów”.
- Nie tworzymy docelowej struktury katalogów na zapas.

## Mapa wersji

| Wersja | Rezultat | Główna nauka |
| --- | --- | --- |
| V1 | Ręczny reviewer CLI bez publikacji | API, kontekst, tool calling, walidacja |
| V2 | Analiza agenta wznawiana po restarcie | Checkpointy, trwały stan, recovery |
| V3 | GitHub App automatycznie publikuje review | Webhooki, trwała kolejka, idempotency |
| V4 | Kontrolowana obsługa awarii i wyścigów | Retry, reconciliation, concurrency |
| V5 | Reviewer działa na VPS i daje się utrzymywać | Deployment, monitoring, backup, koszty |

---

## V1 — CLI Reviewer

### Efekt końcowy

`pnpm dev review <PR_URL>`

CLI pobiera zmiany, pozwala modelowi doczytać potrzebny kontekst i wypisuje zwalidowane uwagi w terminalu. Nie zapisuje niczego na GitHubie. Flaga `--dry-run` nie jest potrzebna ani obsługiwana — w V1 publikacja nie istnieje.

**Poza zakresem:** webhooki, GitHub App, baza danych, Pi Durable, deployment i automatyczne poprawianie kodu.

### V1.1 — Szkielet projektu i wejście CLI

**Status:** zakończone na podstawie przeglądu kodu, z odłożeniem dokumentacji do V1.5 zgodnie z decyzją użytkownika.

**Zadania:**
- [x] Przygotować minimalny projekt TypeScript/Node.js z pnpm i komendą uruchomieniową.
- [x] Ustalić obsługiwaną wersję Node.js 25 i przypiąć zależności przez lockfile.
- [x] Dodać komendę `review <PR_URL>`.
- [x] Walidować URL: HTTPS, host `github.com`, owner, repo oraz dodatni numer PR. GitHub Enterprise poza V1.
- [x] Odrzucać nieobsługiwane argumenty i wyświetlać pomoc oraz czytelne błędy.
- [x] Wykluczyć lokalne pliki z sekretami z Gita.

**Odłożone:** README i opis konfiguracji sekretów — przeniesione do V1.5; nie blokują rozpoczęcia V1.2.

**Gotowe, gdy:** poprawny URL daje owner/repo/numer PR, a błędne wejście kończy się komunikatem i niezerowym kodem wyjścia. Nie ma jeszcze żadnych wywołań GitHuba ani modelu.

**Nauka:** kontrakt wejścia, walidacja i granice odpowiedzialności CLI.

### V1.2 — Pobranie snapshotu PR

**Zadania:**
- [ ] Skonfigurować Octokit i uwierzytelnienie tokenem z uprawnieniami wyłącznie do potrzebnych odczytów.
- [ ] Pobrać metadane PR, w tym bazowe i źródłowe repozytorium oraz `base_sha` i `head_sha`.
- [ ] Obsłużyć paginację listy zmienionych plików.
- [ ] Zachować status pliku, ścieżkę, poprzednią ścieżkę przy rename i dostępny patch.
- [ ] Rozpoznawać brak patcha, pliki binarne oraz limity GitHub API. Nie przedstawiać niepełnych danych jako pełnego diffa.
- [ ] Wprowadzić jawne limity liczby plików i łącznego rozmiaru wejścia do analizy.
- [ ] Sprawdzić, czy baza i head PR nie zmieniły się podczas pobierania. Przy zmianie przerwać z prośbą o ponowne uruchomienie zamiast mieszać wersje.
- [ ] Obsłużyć nieistniejący PR, brak dostępu i limit API czytelnym błędem.

**Gotowe, gdy:** CLI wypisuje snapshot PR i podsumowanie zmian, także przy wielu stronach odpowiedzi. Raportuje pominięte pliki oraz powód pominięcia.

**Nauka:** paginacja, ograniczenia zewnętrznego API, spójność danych podczas odczytu.

### V1.3 — Analiza z ograniczonym kontekstem

**Zadania:**
- [ ] Wybrać jeden model i sprawdzić aktualne API biblioteki Pi do wywołań modelu i narzędzi. Bez Pi Durable.
- [ ] Zdefiniować schemat finding: ścieżka, linia, severity, tytuł i uzasadnienie.
- [ ] Na początek findings wskazują wyłącznie linie nowej wersji widoczne w diffie (`RIGHT`). Uwagi do usuniętych linii są poza V1.
- [ ] Przekazać modelowi diff, zasady review oraz informację o ograniczeniach materiału.
- [ ] Udostępnić tylko `read_file(path)` i `list_directory(path)` w obrębie analizowanego repozytorium i przypiętego SHA. Wyszukiwanie kodu dodać dopiero, jeśli te dwa narzędzia nie wystarczą.
- [ ] Zapewnić poprawny odczyt kontekstu PR z forka; brak dostępu raportować jako ograniczenie, nie zastępować po cichu inną wersją pliku.
- [ ] Ograniczyć rozmiar odpowiedzi narzędzi, liczbę tur, czas analizy i budżet tokenów.
- [ ] Zabronić dowolnych URL-i, lokalnych ścieżek i dostępu do sekretów przez narzędzia.
- [ ] Przy wyczerpaniu budżetu zakończyć kontrolowanie i oznaczyć analizę jako niepełną.

**Gotowe, gdy:** model potrafi doczytać plik z analizowanego commita i zwrócić findings lub pustą listę. Nie ma narzędzi do zapisu ani wykonywania kodu.

**Nauka:** tool calling, zarządzanie kontekstem, granice zaufania i budżet wykonania.

### V1.4 — Walidacja i raport

**Zadania:**
- [ ] Walidować odpowiedź modelu przez Zod; błędnego JSON-a nie traktować jako braku uwag.
- [ ] Sprawdzać ścieżki i numery linii na podstawie sparsowanych hunków diffa, nie tylko liczby linii w pliku.
- [ ] Odrzucać findings z nieobsługiwanych lub pominiętych fragmentów.
- [ ] Usuwać dokładne duplikaty i stosować limit pięciu uwag.
- [ ] Wyświetlać severity, lokalizację, tytuł i wyjaśnienie.
- [ ] Rozróżniać: brak zmian, brak wykrytych błędów, analizę niepełną i błąd wykonania.
- [ ] Wyświetlać czas analizy i zużycie tokenów, jeśli dostawca je udostępnia. Koszt pokazywać wyłącznie jako szacunek oparty na znanych stawkach.

**Gotowe, gdy:** niepoprawna lokalizacja nie trafia do raportu jako poprawna uwaga, a użytkownik wie, czy analiza objęła cały wspierany zakres.

**Ważne:** kod może sprawdzić format i lokalizację finding, ale nie potrafi deterministycznie udowodnić, że zarzut modelu jest prawdziwy. To sprawdzamy przez ewaluację jakości.

**Nauka:** oddzielenie propozycji LLM od danych akceptowanych przez aplikację.

### V1.5 — Weryfikacja i pierwsza ewaluacja

**Zadania:**
- [ ] Dodać testy wejścia CLI, paginacji, pustego diffa, brakującego patcha, walidacji schematu i mapowania linii.
- [ ] Sprawdzić obsługę zmiany SHA podczas pobierania, limitów kontekstu i błędów API.
- [ ] W testach automatycznych używać kontrolowanych odpowiedzi GitHuba i modelu, bez płatnych wywołań LLM.
- [ ] Przygotować mały zestaw kontrolowanych przypadków: błąd logiczny, przypadek brzegowy, podejrzenie wykluczone przez kontekst i zmiana bez błędu.
- [ ] Osobno uruchomić ręczną ewaluację na rzeczywistym modelu oraz wybranym PR w `f1-analysis`.
- [ ] Zapisać wykryte i przeoczone błędy, fałszywe alarmy, czas oraz zużycie tokenów. Pojedynczy udany przykład nie jest oceną jakości całego reviewera.
- [ ] Przygotować README z uruchamianiem, ograniczeniami V1 i opisem konfiguracji sekretów (odłożone z V1.1).

**Gotowe, gdy:** cały przepływ CLI działa, walidacja ma pokrycie testami, a jakość została sprawdzona na kontrolowanych przykładach. Decyzja o V2 uwzględnia wyniki, nie tylko fakt, że model zwraca JSON.

### Minimalny układ plików V1

Na początek wystarczy `src/cli.ts`. W kolejnych krokach dochodzą:
- `src/github.ts` — snapshot i odczyt kontekstu.
- `src/reviewer.ts` — wywołania modelu i ograniczone narzędzia.
- `src/schemas.ts` — kontrakty danych.
- `src/validate-findings.ts` — walidacja lokalizacji i deduplikacja, gdy ta logika powstanie.

---

## V2 — Trwała analiza agenta

**Efekt końcowy:** można przerwać proces podczas analizy i wznowić tę samą pracę, wykorzystując zapisane checkpointy. Nadal wyłącznie CLI, bez publikowania.

### V2.1 — Integracja Pi Durable
- [ ] Sprawdzić aktualne API, zasady replay/retry i gwarancje storage; przypiąć konkretną wersję eksperymentalnego pakietu.
- [ ] Przenieść działającą analizę V1 do Harness i trwałej konwersacji.
- [ ] Zapisywać stan runtime w SQLite i powiązać go ze snapshotem PR oraz wersją konfiguracji analizy.

### V2.2 — Resume i powtarzanie wejścia
- [ ] Dodać identyfikator analizy i jawny sposób jej wznowienia.
- [ ] Rozróżnić wznowienie istniejącej pracy od świadomego uruchomienia nowej analizy.
- [ ] Wykorzystać deduplikację wejścia runtime zgodnie z jej rzeczywistym zakresem, np. konkretną konwersacją.
- [ ] Sprawdzić restart po zapisanym kroku i podczas trwającego wywołania modelu.

**Definition of Done:** zakończone, utrwalone kroki są wykorzystywane po restarcie; stan i wynik pozostają powiązane z tym samym snapshotem. Dokumentujemy, które wywołania mogą zostać powtórzone — nie obiecujemy braku dodatkowego kosztu przy awarii w połowie requestu.

**Nauka:** durable execution nie oznacza automatycznie exactly-once dla zewnętrznych operacji.

---

## V3 — GitHub App i automatyczne review

**Efekt końcowy:** otwarcie PR lub nowy commit uruchamia analizę w tle i publikuje review. Jeden proces Node.js: HTTP i jeden worker; SQLite jako trwała kolejka, bez brokera.

### V3.1 — Bezpieczny odbiór webhooków
- [ ] Skonfigurować GitHub App z minimalnymi uprawnieniami oraz Hono.
- [ ] Weryfikować podpis na surowym body przed przetwarzaniem payloadu.
- [ ] Obsłużyć jawnie wybrane zdarzenia, np. `opened`, `synchronize`, `reopened`; ustalić politykę dla draftów.
- [ ] Zapisywać zadanie przed odpowiedzią 202. Przy błędzie zapisu nie potwierdzać przyjęcia.
- [ ] Ograniczyć dostęp do instalacji i repozytoriów, które aplikacja ma obsługiwać.

### V3.2 — Trwałe zadania i jeden worker
- [ ] Zaprojektować własną tabelę zadań z unikalnością dla installation/repository ID + numer PR + head SHA, snapshotem bazowym, statusem, wynikiem i identyfikatorem konwersacji.
- [ ] Rozróżnić delivery ID webhooka od klucza biznesowego zadania. Kilka zdarzeń może dotyczyć tej samej wersji PR.
- [ ] Ustalić politykę zmian bazy PR: w MVP nie obiecywać automatycznej ponownej analizy przy każdej zmianie brancha bazowego; wykrytą zmianę snapshotu obsługiwać jawnie.
- [ ] Zapewnić atomowe przyjęcie zadania i wybór pracy przez jednego workera.
- [ ] Wprowadzić stany `PENDING`, `RUNNING`, `READY_TO_PUBLISH`, `PUBLISHING`, `PUBLISHED`, `FAILED`, `SUPERSEDED`, `CANCELLED` oraz dozwolone przejścia.
- [ ] Zapisywać zwalidowany wynik przed publikacją.
- [ ] Zapewnić odzyskanie niedokończonych zadań po restarcie i powiązanie z runtime. Dwie bazy SQLite nie tworzą wspólnej transakcji — powiązanie musi dać się odtworzyć.

### V3.3 — Kontrolowana publikacja
- [ ] Publikować maksymalnie pięć uwag w GitHub Review typu `COMMENT`, bez automatycznego approve/request changes.
- [ ] Przed publikacją sprawdzać stan PR i zgodność snapshotu; zamknięty PR anulować, nieaktualną analizę oznaczać jako superseded.
- [ ] Przekazywać analizowany `commit_id` i poprawne `line`/`side`.
- [ ] Nadać publikacji stabilny identyfikator, umieścić marker w body review i zapisać otrzymany GitHub review ID.
- [ ] Po niejednoznacznym wyniku publikacji szukać istniejącego review tego bota z markerem, zamiast natychmiast ponawiać POST.
- [ ] Zdecydować o wyniku bez findings: domyślnie zapisać go lokalnie bez pustego komentarza.

**Definition of Done:** webhook uruchamia pełny przepływ, powtórzone zdarzenia nie tworzą nowych analiz tego samego zadania, a podstawowy restart jest obsługiwany. Publikacja ma odzyskiwalny stan i mechanizm uzgadniania z GitHubem.

**Ograniczenie:** sprawdzenie SHA i publikacja nie są atomową operacją GitHuba. Push pomiędzy nimi nadal może wystąpić. `commit_id` przypina uwagi do właściwej wersji, ale nie gwarantuje, że w momencie publikacji jest ona najnowsza. Marker również nie daje ścisłego exactly-once.

---

## V4 — Odporność na awarie i współbieżność

**Efekt końcowy:** zachowanie systemu w awariach jest przewidywalne, możliwe do odtworzenia i udokumentowane.

### V4.1 — Retry i odzyskiwanie
- [ ] Rozróżnić błędy trwałe, przejściowe i niejednoznaczny wynik operacji zapisu.
- [ ] Zapisywać liczbę prób, termin kolejnej próby i ostatni błąd.
- [ ] Uwzględniać `Retry-After` i limity GitHuba, także odpowiedzi 403 związane z rate limitingiem.
- [ ] Stosować ograniczony backoff z jitterem bez nakładania niezależnych pętli retry aplikacji i runtime.
- [ ] Dodać jawne ponowienie zadania zakończonego błędem i uzgadnianie stanów wymagających interwencji.
- [ ] Zaplanować odzyskiwanie niedostarczonych webhooków — nie zakładać, że GitHub automatycznie ponowi każde nieudane dostarczenie.

### V4.2 — Wyścigi i fault injection
- [ ] Sprawdzić zabicie procesu podczas analizy, przed publikacją oraz po zapisie review na GitHubie, ale przed lokalnym zapisem sukcesu.
- [ ] Sprawdzić powtórzone i dostarczone w odwrotnej kolejności webhooki.
- [ ] Sprawdzić nowy commit, force-push, zamknięcie PR i utratę uprawnień podczas pracy.
- [ ] Sprawdzić timeout publikacji, niedostępność storage i wyczerpanie budżetu modelu.
- [ ] Udokumentować scenariusze, w których nadal możliwe są stare uwagi lub duplikaty.

### V4.3 — Opcjonalna równoległość
- [ ] Dopiero jeśli jedna analiza naraz jest realnym ograniczeniem, dopuścić ograniczoną liczbę równoległych PR.
- [ ] Wtedy zapewnić wyłączność aktywnej pracy dla jednego PR i kontrolę posiadania zadania przed zapisami/publikacją.
- [ ] Nie dodawać wielu procesów ani distributed locks bez potrzeby.

**Definition of Done:** scenariusze awaryjne mają sprawdzony oczekiwany wynik; zadania nie znikają po potwierdzeniu webhooka i nie pozostają bezterminowo w stanie wymagającym recovery.

---

## V5 — Deployment i utrzymanie

**Efekt końcowy:** aplikacja działa na VPS, przetrzymuje restart kontenera i pozwala ustalić, co dzieje się z zadaniami oraz kosztami.

### V5.1 — Uruchomienie produkcyjne
- [ ] Przygotować Docker/Compose, HTTPS i trwały wolumen SQLite.
- [ ] Zapewnić sekrety poza obrazem i repozytorium, poprawne uprawnienia plików i rotację sekretów.
- [ ] Dodać healthcheck, graceful shutdown i procedurę bezpiecznej aktualizacji.
- [ ] Przygotować backup SQLite oraz sprawdzić odtworzenie obu baz i ich powiązań.

### V5.2 — Obserwowalność i ograniczenia
- [ ] Logować strukturalnie job ID, repo/PR, SHA, etap, próby, czas i błędy, bez sekretów i niepotrzebnego kodu źródłowego.
- [ ] Zapisywać zużycie tokenów, szacowany koszt i liczbę wznowień.
- [ ] Udostępnić historię zadań przez proste CLI lub odczyt administracyjny, bez dashboardu.
- [ ] Ograniczyć rozmiar kolejki, wielkość PR, czas pracy oraz budżet analizy.
- [ ] Ustalić retencję danych i procedurę reagowania na rosnącą kolejkę, brak miejsca oraz powtarzające się błędy.

**Definition of Done:** webhook z GitHuba uruchamia review na VPS; restart kontenera nie gubi przyjętej pracy, backup można odtworzyć, a operator potrafi wyjaśnić wynik dowolnego zadania.

---

## Sposób pracy

1. Realizujemy jeden podetap naraz, zaczynając od V1.1.
2. Przed implementacją wskazujemy konkretne pliki, zmiany i ich cel.
3. Po podetapie sprawdzamy jego kryterium ukończenia i aktualizujemy checklistę.
4. Testy wymienione w planie opisują docelowy zakres. Pisanie kodu, testów i commitowanie następuje na osobne polecenie użytkownika.
5. Przed przejściem do kolejnej wersji odpowiadamy:
   - Co się stanie, gdy proces padnie?
   - Co się stanie, gdy to samo wejście przyjdzie dwa razy?
   - Co się stanie, gdy dane zmienią się podczas pracy?
6. W V1 świadomie akceptujemy ponowne wykonanie po crashu i brak deduplikacji analiz, ponieważ nie ma zewnętrznych zapisów. Te kompromisy zmieniają się przy automatycznej publikacji.

## Następne zadanie do rozpoczęcia

**V1.2: skonfigurować Octokit i pobrać metadane PR.**

Pierwszy krok: zainstalować Octokit, przekazać token GitHuba przez zmienną środowiskową i dodać `src/github.ts` do odczytu metadanych wskazanego PR. Token ma mieć wyłącznie potrzebne uprawnienia do odczytu i nie może trafiać do logów ani repozytorium.

Na koniec pierwszego kroku CLI ma wypisać bazowe i źródłowe repozytorium oraz `base_sha` i `head_sha`. Paginacja plików, limity i kontrola spójności snapshotu pozostają kolejnymi krokami V1.2. Nie instalujemy Pi Durable, Hono ani SQLite i nie integrujemy modelu.
