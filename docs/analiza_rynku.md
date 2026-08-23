## **Analiza stanu wiedzy i przegląd rozwiązań rynkowych**

**1\. Wprowadzenie i charakterystyka obecnego rynku**

W internecie jest wiele źródeł predykcji pogodowych, takich jak serwisy:

* Windy,   
* Ventusky,   
* AccuWeather   
* IMGW (podstrona Polskiego instytutu meteorologicznego)

Rozwiązania te dostarczają użytkownikom wizualizacje danych pochodzących z wielu globalnych i lokalnych modeli predykcyjnych. Mimo zaawansowania technologicznego, istniejące systemy przerzucają na użytkownika ciężar analityczny – to odbiorca musi samodzielnie zinterpretować, który z dostępnych modeli pogodowych charakteryzuje się najwyższą sprawdzalnością dla jego konkretnej lokalizacji. Ponadto, systemy ostrzegania w popularnych aplikacjach ograniczają się zazwyczaj do ogólnych powiadomień push lub wiadomości e-mail, nie dając możliwości głębokiej personalizacji preferowanych powiadomień.

**2\. Identyfikacja luki rynkowej**

Brakuje rozwiązania, które autonomicznie weryfikowałoby historyczną sprawdzalność modeli dla konkretnych współrzędnych geograficznych i na tej podstawie serwowało zoptymalizowaną prognozę. 

Drugim zidentyfikowanym brakiem jest niedostateczna elastyczność w komunikacji z użytkownikiem – brakuje narzędzi pozwalających na integrację z popularnymi komunikatorami (np. Discord, Telegram) w oparciu o precyzyjnie zdefiniowane warunki brzegowe (np. spadek temperatury poniżej 0°C w ściśle określonym czasie).

**3\. Innowacyjność proponowanego rozwiązania** 

Projektowany system, "Internetowy portal pogodowy z inteligentną predykcją pogodową dla Polski", stanowi bezpośrednią odpowiedź na zidentyfikowane problemy. Jego przewaga technologiczna i rynkowa opiera się na dwóch filarach:

* **Zautomatyzowana selekcja modelu predykcyjnego:** W przeciwieństwie do konkurencji, system nie wymaga od użytkownika wyboru źródła danych. Na podstawie przeprowadzonych backtestów, w których funkcję *ground truth* pełni reanaliza ERA5 od instytutu ECMWF , system sam wnioskuje, jaki jest najlepszy model predykcyjny dla każdego punktu geograficznego znajdującego się na terenie Polski. Badanie to odbywa się z wysoką rozdzielczością, co 0.25° wysokości/szerokości geograficznej.  
* **Hiper-spersonalizowany system powiadomień:** Użytkownik może ustawić powiadomienia na wybrany przez niego komunikator, na który otrzyma powiadomienie w momencie, gdy nasza prognoza przewidzi wystąpienie zdefiniowanych warunków meteorologicznych.

**4\. Grupy docelowe i wartość biznesowa**

Zaproponowana architektura systemu dostarcza wymierną wartość dla odbiorców, dla których precyzyjna i terminowa informacja pogodowa jest kluczowa z punktu widzenia optymalizacji kosztów i bezpieczeństwa. Głównymi grupami docelowymi są:

* **Zarządcy nieruchomości i infrastruktury:** Możliwość automatyzacji procesów (np. uruchamianie systemów grzewczych z wyprzedzeniem na podstawie alertu o zbliżających się przymrozkach).  
* **Sektor rolniczy i sadowniczy:** Ochrona upraw dzięki precyzyjnym alertom dla konkretnych działek ewidencyjnych.  
* **Branża budowlana:** Harmonogramowanie prac wrażliwych na warunki atmosferyczne (prace na wysokościach, wylewanie betonu) na konkretnym placu budowy.  
* **Logistyka:** Ostrzeganie spedytorów o zbliżających się trudnych warunkach pogodowych.

Nasz projekt ma zautomatyzować problem “Jeśli X to poinformuj Y”.