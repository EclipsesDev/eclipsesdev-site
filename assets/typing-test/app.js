const EVENTS = {
  NAV: "popstate",
  LOAD: "DOMContentLoaded"
};
const API = ["https://api.", "eclipsesdev", ".top/sentence/"].join("");

document.addEventListener(EVENTS.LOAD, () => {
    const textDisplay = document.getElementById("text-display");
    const inputField = document.getElementById("input-field");
    const timeElement = document.getElementById("time");
    const wpmElement = document.getElementById("wpm");
    const accuracyElement = document.getElementById("accuracy");
    const restartBtn = document.getElementById("restart");

    let timer = 60;
    let interval = null;
    let started = false;
    let mistakes = 0;
    let errorHistory = [];

    let currentDifficulty = "easy";

    const difficultyButtons = document.querySelectorAll(".difficulty-btn");

    difficultyButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            difficultyButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentDifficulty = btn.dataset.difficulty;
            restartBtn.click();
        });
    });

    async function loadText() {
    textDisplay.innerHTML = "Loading text...";

    try {
        const response = await fetch(`${API}${currentDifficulty}`);
        const data = await response.json();

        const text = data.text;

        textDisplay.innerHTML = "";

        text.split("").forEach(char => {
            const span = document.createElement("span");
            span.innerText = char;
            textDisplay.appendChild(span);
        });

        errorHistory = new Array(text.length).fill(false);

        if (textDisplay.children.length > 0) {
            textDisplay.children[0].classList.add("current");
        }

        } catch (err) {
            textDisplay.innerHTML = "Failed to load text.";
            console.error(err);
        }
    }

    function startTimer() {
        interval = setInterval(() => {
            timer--;
            timeElement.innerText = timer;

            if (timer <= 0) {
                clearInterval(interval);
                inputField.disabled = true;
            }

            updateStats();
        }, 1000);
    }

    inputField.addEventListener("input", () => {
        if (!started) {
            started = true;
            startTimer();
        }

        const characters = textDisplay.querySelectorAll("span");
        const typed = inputField.value.split("");

        mistakes = 0;

        characters.forEach((char, index) => {
            char.classList.remove("correct", "incorrect", "current");

            if (typed[index] == null) {
                if (index === typed.length) {
                    char.classList.add("current");
                }
            } else if (typed[index] === char.innerText) {
                char.classList.add("correct");
            } else {
                char.classList.add("incorrect");
                mistakes++;

                errorHistory[index] = true;
            }
        });

        if (typed.length === characters.length) {
            clearInterval(interval);
            inputField.disabled = true;
        }

        updateStats();
    });

    function updateStats() {
        const characters = textDisplay.querySelectorAll("span");
        const timeElapsed = 60 - timer;
        const minutes = timeElapsed / 60;

        if (minutes > 0) {
            const wordsTyped = inputField.value.length / 5;
            const wpm = Math.round(wordsTyped / minutes);
            wpmElement.innerText = wpm;
        } else {
            wpmElement.innerText = 0;
        }

        // Count accuracy of index that ever had an error as incorrect
        const targetLength = characters.length || 0;
        const errorsEver = errorHistory.filter(Boolean).length;

        const accuracy = started && targetLength > 0
            ? Math.max(0, Math.round(((targetLength - errorsEver) / targetLength) * 100))
            : 100;

        accuracyElement.innerText = accuracy;
    }

    restartBtn.addEventListener("click", () => {
        timer = 60;
        started = false;
        inputField.value = "";
        inputField.disabled = false;
        clearInterval(interval);
        timeElement.innerText = timer;
        wpmElement.innerText = 0;
        accuracyElement.innerText = 100;
        errorHistory = [];
        inputField.focus();
        loadText();
    });

    textDisplay.addEventListener("copy", (e) => {
        e.preventDefault();
    });

    document.addEventListener("keydown", (e) => {
        if (
            document.activeElement === inputField &&
            e.ctrlKey &&
            e.key === "v"
        ) {
            e.preventDefault();
        }
    });

    inputField.addEventListener("paste", (e) => {
        e.preventDefault();
    });

    loadText();
    inputField.focus();
});