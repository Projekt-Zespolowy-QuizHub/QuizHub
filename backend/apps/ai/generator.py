import json
import asyncio
import random
import logging
from typing import Optional
import google.generativeai as genai
from django.conf import settings

logger = logging.getLogger(__name__)

CATEGORIES_PL = {
    "Historia":       "Historia",
    "Nauka":          "Nauka",
    "Geografia":      "Geografia",
    "Film i Seriale": "Film i Seriale",
    "Gaming":         "Gry wideo",
    "Muzyka":         "Muzyka",
    "Sport":          "Sport",
    "Technologia":    "Technologia",
    "Jedzenie":       "Jedzenie i kuchnia",
    "Sztuka":         "Sztuka i kultura",
}

SYSTEM_PROMPT = """Jesteś generatorem pytań quizowych. Twoim jedynym zadaniem jest zwrócenie poprawnego JSON-a.
Nigdy nie wypisuj nic poza JSON-em. Bez markdownu, bez backticków, bez wyjaśnień.
Zawsze odpowiadaj WYŁĄCZNIE po polsku, w dokładnie takiej strukturze:
{
  "question": "Treść pytania po polsku?",
  "options": ["Opcja A po polsku", "Opcja B po polsku", "Opcja C po polsku", "Opcja D po polsku"],
  "correct": "A",
  "explanation": "Krótkie wyjaśnienie po polsku dlaczego A jest poprawne."
}
Pole "correct" musi być dokładnie jednym z: "A", "B", "C", "D".
Twórz ciekawe, jednoznaczne pytania o zróżnicowanym poziomie trudności.
Wszystko MUSI być po polsku — pytanie, opcje i wyjaśnienie.
"""

# Pula fallback pytań na wypadek wyczerpania API
FALLBACK_QUESTIONS = {
    "Historia": [
        {"question": "W którym roku zakończyła się II wojna światowa?", "options": ["1943", "1944", "1945", "1946"], "correct": "C", "explanation": "II wojna światowa zakończyła się w 1945 roku."},
        {"question": "Kto był pierwszym królem Polski?", "options": ["Mieszko I", "Bolesław Chrobry", "Kazimierz Wielki", "Władysław Łokietek"], "correct": "B", "explanation": "Bolesław Chrobry został koronowany w 1025 roku jako pierwszy król Polski."},
        {"question": "W którym roku Polska odzyskała niepodległość?", "options": ["1916", "1917", "1918", "1919"], "correct": "C", "explanation": "Polska odzyskała niepodległość 11 listopada 1918 roku."},
        {"question": "Kto odkrył Amerykę w 1492 roku?", "options": ["Vasco da Gama", "Krzysztof Kolumb", "Ferdynand Magellan", "Amerigo Vespucci"], "correct": "B", "explanation": "Krzysztof Kolumb dotarł do Ameryki 12 października 1492 roku."},
    ],
    "Nauka": [
        {"question": "Jaki jest symbol chemiczny złota?", "options": ["Ag", "Fe", "Au", "Cu"], "correct": "C", "explanation": "Au (od łacińskiego aurum) to symbol chemiczny złota."},
        {"question": "Ile planet jest w Układzie Słonecznym?", "options": ["7", "8", "9", "10"], "correct": "B", "explanation": "W Układzie Słonecznym jest 8 planet (od Plutona nie jest już planetą)."},
        {"question": "Co jest najmniejszą jednostką życia?", "options": ["Atom", "Cząsteczka", "Komórka", "Tkanka"], "correct": "C", "explanation": "Komórka jest podstawową jednostką strukturalną i funkcjonalną organizmów żywych."},
        {"question": "Jaka jest prędkość światła w próżni?", "options": ["150 000 km/s", "300 000 km/s", "450 000 km/s", "600 000 km/s"], "correct": "B", "explanation": "Prędkość światła w próżni wynosi około 300 000 km/s."},
    ],
    "Geografia": [
        {"question": "Jaka jest stolica Australii?", "options": ["Sydney", "Melbourne", "Canberra", "Brisbane"], "correct": "C", "explanation": "Stolicą Australii jest Canberra, nie Sydney jak wielu myśli."},
        {"question": "Która rzeka jest najdłuższa na świecie?", "options": ["Amazonka", "Nil", "Jangcy", "Missisipi"], "correct": "B", "explanation": "Nil o długości ok. 6650 km jest uznawany za najdłuższą rzekę świata."},
        {"question": "W jakim kraju znajduje się Machu Picchu?", "options": ["Boliwia", "Kolumbia", "Peru", "Ekwador"], "correct": "C", "explanation": "Machu Picchu to starożytne miasto Inków znajdujące się w Peru."},
        {"question": "Ile kontynentów jest na Ziemi?", "options": ["5", "6", "7", "8"], "correct": "C", "explanation": "Na Ziemi jest 7 kontynentów: Europa, Azja, Afryka, Ameryka Północna, Ameryka Południowa, Australia i Antarktyda."},
    ],
    "Film i Seriale": [
        {"question": "Kto wyreżyserował film 'Incepcja'?", "options": ["Steven Spielberg", "Christopher Nolan", "Martin Scorsese", "Quentin Tarantino"], "correct": "B", "explanation": "Christopher Nolan wyreżyserował 'Incepcję' w 2010 roku."},
        {"question": "Ile filmów o Harrym Potterze nakręcono?", "options": ["6", "7", "8", "9"], "correct": "C", "explanation": "Nakręcono 8 filmów o Harrym Potterze (ostatnia książka podzielona na 2 filmy)."},
        {"question": "W którym roku premierę miał pierwszy film 'Gwiezdne Wojny'?", "options": ["1975", "1977", "1979", "1980"], "correct": "B", "explanation": "'Gwiezdne Wojny: Nowa Nadzieja' miały premierę w 1977 roku."},
    ],
    "Gaming": [
        {"question": "W którym roku wydano grę Minecraft?", "options": ["2009", "2010", "2011", "2012"], "correct": "C", "explanation": "Pełna wersja Minecrafta została wydana 18 listopada 2011 roku."},
        {"question": "Jak nazywa się główny bohater serii 'The Legend of Zelda'?", "options": ["Zelda", "Link", "Ganon", "Epona"], "correct": "B", "explanation": "Głównym bohaterem jest Link, a Zelda to księżniczka."},
        {"question": "Która firma stworzyła konsolę PlayStation?", "options": ["Nintendo", "Microsoft", "Sony", "Sega"], "correct": "C", "explanation": "PlayStation to konsola stworzona przez firmę Sony."},
    ],
    "Muzyka": [
        {"question": "Kto skomponował 'Sonatę Księżycową'?", "options": ["Mozart", "Beethoven", "Chopin", "Bach"], "correct": "B", "explanation": "Sonatę Księżycową skomponował Ludwig van Beethoven w 1801 roku."},
        {"question": "Z jakiego kraju pochodzi zespół ABBA?", "options": ["Norwegia", "Dania", "Finlandia", "Szwecja"], "correct": "D", "explanation": "ABBA to szwedzki zespół muzyczny założony w 1972 roku."},
        {"question": "Ile strun ma standardowa gitara?", "options": ["4", "5", "6", "7"], "correct": "C", "explanation": "Standardowa gitara ma 6 strun."},
    ],
    "Sport": [
        {"question": "Ile graczy liczy drużyna piłki nożnej na boisku?", "options": ["9", "10", "11", "12"], "correct": "C", "explanation": "Drużyna piłki nożnej składa się z 11 graczy na boisku."},
        {"question": "W którym kraju odbyły się Letnie Igrzyska Olimpijskie 2020?", "options": ["Chiny", "Japonia", "Korea Południowa", "Australia"], "correct": "B", "explanation": "Igrzyska Olimpijskie 2020 odbyły się w Tokio (Japonia) w 2021 roku."},
        {"question": "Ile setów trzeba wygrać w meczu tenisa mężczyzn w Wielkim Szlemie?", "options": ["2", "3", "4", "5"], "correct": "B", "explanation": "W Wielkim Szlemie mężczyźni grają do 3 wygranych setów (best of 5)."},
    ],
    "Technologia": [
        {"question": "W którym roku powstał pierwszy iPhone?", "options": ["2005", "2006", "2007", "2008"], "correct": "C", "explanation": "Pierwszy iPhone został zaprezentowany w styczniu 2007 roku."},
        {"question": "Kto jest założycielem Microsoftu?", "options": ["Steve Jobs", "Bill Gates", "Mark Zuckerberg", "Jeff Bezos"], "correct": "B", "explanation": "Bill Gates wraz z Paulem Allenem założył Microsoft w 1975 roku."},
        {"question": "Co oznacza skrót HTML?", "options": ["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Logic", "Home Tool Markup Language"], "correct": "A", "explanation": "HTML to Hyper Text Markup Language — język znaczników hipertekstowych."},
    ],
    "Jedzenie": [
        {"question": "Z jakiego kraju pochodzi sushi?", "options": ["Chiny", "Korea", "Japonia", "Tajlandia"], "correct": "C", "explanation": "Sushi pochodzi z Japonii."},
        {"question": "Jaki jest główny składnik guacamole?", "options": ["Pomidor", "Awokado", "Papryka", "Cebula"], "correct": "B", "explanation": "Głównym składnikiem guacamole jest awokado."},
        {"question": "Z jakiego kraju pochodzi pizza?", "options": ["Francja", "Hiszpania", "Grecja", "Włochy"], "correct": "D", "explanation": "Pizza pochodzi z Włoch, a konkretnie z Neapolu."},
    ],
    "Sztuka": [
        {"question": "Kto namalował 'Mona Lisę'?", "options": ["Michelangelo", "Leonardo da Vinci", "Raphael", "Donatello"], "correct": "B", "explanation": "Mona Lisa została namalowana przez Leonarda da Vinci w XVI wieku."},
        {"question": "W jakim mieście znajduje się Luwr?", "options": ["Londyn", "Rzym", "Paryż", "Madryt"], "correct": "C", "explanation": "Luwr (Musée du Louvre) znajduje się w Paryżu."},
        {"question": "Kto namalował 'Gwiaździstą noc'?", "options": ["Claude Monet", "Pablo Picasso", "Vincent van Gogh", "Salvador Dalí"], "correct": "C", "explanation": "Gwiaździstą noc namalował Vincent van Gogh w 1889 roku."},
    ],
}


def get_category_for_round(categories: list[str], round_number: int) -> str:
    """Rozdziela rundy równo na kategorie."""
    if not categories:
        return "Wiedza ogólna"
    idx = (round_number - 1) % len(categories)
    return categories[idx]


class QuestionGenerator:
    def __init__(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=SYSTEM_PROMPT,
        )

    async def generate(
        self,
        category: str,
        used_questions: list[str],
        max_retries: int = 3,
    ) -> dict:
        category_pl = CATEGORIES_PL.get(category, category)

        used_str = ""
        if used_questions:
            last_used = used_questions[-10:]
            used_str = f"\n\nNIE powtarzaj tych pytań:\n" + "\n".join(f"- {q}" for q in last_used)

        prompt = f"""Wygeneruj JEDNO pytanie quizowe z kategorii: {category_pl}.

Pytanie MUSI dotyczyć wyłącznie tematyki "{category_pl}". Nie mieszaj z innymi kategoriami.
{used_str}

Pamiętaj: zwróć TYLKO obiekt JSON, nic więcej. Wszystko po polsku!"""

        for attempt in range(max_retries):
            try:
                response = await asyncio.to_thread(
                    self.model.generate_content, prompt
                )
                raw = response.text.strip()

                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                    raw = raw.strip()

                data = json.loads(raw)

                assert "question" in data
                assert "options" in data and len(data["options"]) == 4
                assert data.get("correct") in ("A", "B", "C", "D")

                return data

            except (json.JSONDecodeError, AssertionError, KeyError) as e:
                logger.warning(f"Gemini parse error (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(1)

            except Exception as e:
                logger.warning(f"Gemini API error: {e}")
                # Przy rate limit — nie retryuj, od razu fallback
                break

        return self._fallback_question(category, used_questions)

    def _fallback_question(self, category: str, used_questions: list[str]) -> dict:
        """Losowe pytanie z puli offline."""
        pool = FALLBACK_QUESTIONS.get(category, [])
        if not pool:
            # Zbierz z wszystkich kategorii
            pool = [q for qs in FALLBACK_QUESTIONS.values() for q in qs]

        # Filtruj użyte
        available = [q for q in pool if q['question'] not in used_questions]
        if not available:
            available = pool

        return random.choice(available)
