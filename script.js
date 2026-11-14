"use strict";

/*
  BASIC MODE
  Matches existing dishes to the user's ingredient list.

  AI MODE
  Uses these server endpoints:
  GET  /api/status
  POST /api/dish

  Never put an API key in this file.
*/

// --------------------------------------------------
// Basic dish collection
// --------------------------------------------------

const DISHES = [
  {
    name: "Spinach and tomato scramble",
    ingredients: ["eggs", "spinach", "tomatoes"],
    periodFocus: true
  },
  {
    name: "Lentil and tomato rice bowl",
    ingredients: ["lentils", "tomatoes", "rice", "spinach"],
    periodFocus: true
  },
  {
    name: "Chickpea crunch salad",
    ingredients: ["chickpeas", "cucumber", "tomatoes", "lemon"],
    periodFocus: true
  },
  {
    name: "Tofu and broccoli rice bowl",
    ingredients: ["tofu", "broccoli", "rice", "olive oil"],
    periodFocus: true
  },
  {
    name: "White bean tomato pasta",
    ingredients: ["white beans", "pasta", "tomatoes", "spinach"],
    periodFocus: true
  },
  {
    name: "Black bean stuffed sweet potato",
    ingredients: ["black beans", "sweet potato", "tomatoes"],
    periodFocus: true
  },
  {
    name: "Chicken and vegetable rice bowl",
    ingredients: ["chicken", "rice", "carrots", "broccoli"],
    periodFocus: false
  },
  {
    name: "Salmon and broccoli plate",
    ingredients: ["salmon", "broccoli", "rice", "lemon"],
    periodFocus: false
  },
  {
    name: "Peanut tofu noodles",
    ingredients: ["tofu", "pasta", "bell pepper", "peanut butter"],
    periodFocus: false
  },
  {
    name: "Tomato and egg toast",
    ingredients: ["eggs", "tomatoes", "bread"],
    periodFocus: false
  },
  {
    name: "Banana peanut oats",
    ingredients: ["oats", "banana", "peanut butter"],
    periodFocus: false
  },
  {
    name: "Berry yogurt bowl",
    ingredients: ["yogurt", "berries", "oats"],
    periodFocus: false
  },
  {
    name: "Warm lentil vegetable bowl",
    ingredients: ["lentils", "carrots", "spinach", "bell pepper"],
    periodFocus: true
  },
  {
    name: "Chickpea and quinoa bowl",
    ingredients: ["chickpeas", "quinoa", "tomatoes", "lemon"],
    periodFocus: true
  }
];

const ALIASES = {
  "egg": "eggs",
  "tomato": "tomatoes",
  "lentil": "lentils",
  "chickpea": "chickpeas",
  "garbanzo beans": "chickpeas",
  "carrot": "carrots",
  "pepper": "bell pepper",
  "bell peppers": "bell pepper",
  "sweet potatoes": "sweet potato",
  "rolled oats": "oats",
  "brown rice": "rice",
  "white rice": "rice",
  "whole wheat pasta": "pasta",
  "whole wheat bread": "bread",
  "yoghurt": "yogurt"
};

// --------------------------------------------------
// Page elements
// --------------------------------------------------

const form = document.querySelector("#meal-form");
const ingredientInput = document.querySelector("#ingredients");
const ingredientList = document.querySelector("#ingredient-list");

const periodToggle = document.querySelector("#period-toggle");
const generateButton = document.querySelector("#generate-button");
const buttonLabel = document.querySelector("#button-label");

const modeLabel = document.querySelector("#mode-label");
const privacyNote = document.querySelector("#privacy-note");
const statusElement = document.querySelector("#status");
const resultElement = document.querySelector("#result");

let aiReady = false;
let isGenerating = false;
let previousName = "";

// --------------------------------------------------
// Ingredient handling
// --------------------------------------------------

function normalizeIngredient(value) {
  const cleaned = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

  return Object.prototype.hasOwnProperty.call(ALIASES, cleaned)
    ? ALIASES[cleaned]
    : cleaned;
}

function parseIngredients(value) {
  return new Set(
    value
      .split(/[,\n]+/)
      .map(normalizeIngredient)
      .filter(Boolean)
  );
}

function createElement(tag, text, className) {
  const element = document.createElement(tag);

  if (text !== undefined) {
    element.textContent = text;
  }

  if (className) {
    element.className = className;
  }

  return element;
}

function updateIngredientList() {
  const ingredients = parseIngredients(ingredientInput.value);

  ingredientList.replaceChildren();

  ingredients.forEach(ingredient => {
    ingredientList.append(
      createElement("li", ingredient, "chip")
    );
  });

  if (previousName) {
    statusElement.textContent =
      "Ingredients changed. Suggest a dish again to update your result.";
  }
}

ingredientInput.addEventListener("input", updateIngredientList);

// --------------------------------------------------
// Check whether a real AI backend is connected
// --------------------------------------------------

async function checkAIAvailability() {
  try {
    if (!["http:", "https:"].includes(window.location.protocol)) {
      throw new Error("Local basic mode");
    }

    const controller = new AbortController();

    const timeout = window.setTimeout(() => {
      controller.abort();
    }, 5000);

    try {
      const response = await fetch("/api/status", {
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error("AI status unavailable");
      }

      const data = await response.json();
      aiReady = data.aiReady === true;
    } finally {
      window.clearTimeout(timeout);
    }
  } catch {
    aiReady = false;
  }

  if (aiReady) {
    modeLabel.textContent = "AI dish suggestions";

    privacyNote.textContent =
      "Your ingredients and optional period setting are sent to " +
      "Anthropic when you generate a dish. This site does not save them.";
  } else {
    modeLabel.textContent =
      "Basic suggestions · AI not connected";

    privacyNote.textContent =
      "Basic mode matches existing dishes; it is not AI-generated. " +
      "Your ingredients and period setting stay in this tab.";
  }
}

const availabilityCheck = checkAIAvailability();

// --------------------------------------------------
// Basic suggestion mode
// --------------------------------------------------

function getMatchingIngredients(dish, pantry) {
  return dish.ingredients.filter(ingredient => {
    return pantry.has(normalizeIngredient(ingredient));
  });
}

function scoreDish(dish, pantry, onPeriod) {
  const matches = getMatchingIngredients(dish, pantry).length;

  const ingredientScore = matches * 4;
  const coverageScore = (matches / dish.ingredients.length) * 3;

  const periodScore =
    onPeriod && dish.periodFocus ? 4 : 0;

  return ingredientScore + coverageScore + periodScore;
}

function createBasicSuggestion(ingredientText, onPeriod) {
  const pantry = parseIngredients(ingredientText);

  let candidates = DISHES.filter(dish => {
    return getMatchingIngredients(dish, pantry).length > 0;
  });

  if (candidates.length === 0) {
    throw new Error(
      "Basic mode has no matches for these ingredients. " +
      "Try names such as eggs, rice, spinach, tomatoes, or lentils."
    );
  }

  // Try a different matching dish when regenerating.
  const alternatives = candidates.filter(dish => {
    return dish.name !== previousName;
  });

  if (alternatives.length > 0) {
    candidates = alternatives;
  }

  candidates.sort((a, b) => {
    return (
      scoreDish(b, pantry, onPeriod) -
      scoreDish(a, pantry, onPeriod)
    );
  });

  const selected = candidates[0];

  const uses = getMatchingIngredients(selected, pantry);

  const extras = selected.ingredients.filter(ingredient => {
    return !pantry.has(normalizeIngredient(ingredient));
  });

  let note =
    "Selected to use the foods you listed. Check any additions below.";

  if (onPeriod) {
    note = selected.periodFocus
      ? "Selected with a preference for iron-containing foods paired " +
        "with vitamin C. This is general nutrition support, not a " +
        "treatment for period symptoms."
      : "This dish matches your kitchen. The basic collection has no " +
        "stronger period-focused match for this suggestion.";
  }

  if (selected.name === previousName) {
    note += " This is still the only matching dish in basic mode.";
  }

  return {
    name: selected.name,
    uses,
    extras,
    note
  };
}

// --------------------------------------------------
// Validate a server response
// --------------------------------------------------

function isValidDish(dish) {
  const isText = value => {
    return (
      typeof value === "string" &&
      value.length <= 1500
    );
  };

  const isIngredientArray = value => {
    return (
      Array.isArray(value) &&
      value.length <= 30 &&
      value.every(isText)
    );
  };

  return Boolean(
    dish &&
    isText(dish.name) &&
    dish.name.trim() &&
    isText(dish.note) &&
    isIngredientArray(dish.uses) &&
    isIngredientArray(dish.extras)
  );
}

// --------------------------------------------------
// Real AI request — handled by your server
// --------------------------------------------------

async function requestAIDish(ingredients, onPeriod) {
  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, 65000);

  try {
    const response = await fetch("/api/dish", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        ingredients,
        onPeriod,
        previousName
      }),

      signal: controller.signal
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "The AI could not generate a dish. Please try again."
      );
    }

    if (!isValidDish(data)) {
      throw new Error(
        "The suggestion was incomplete. Please try again."
      );
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "That took too long. Please try again."
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

// --------------------------------------------------
// Display one dish
// --------------------------------------------------

function appendIngredientSection(card, title, ingredients, className) {
  card.append(createElement("h4", title));

  const list = createElement(
    "ul",
    undefined,
    "dish-ingredients" + (className ? " " + className : "")
  );

  ingredients.forEach(ingredient => {
    list.append(createElement("li", ingredient));
  });

  card.append(list);
}

function displayDish(dish, onPeriod, generatedWithAI) {
  if (!isValidDish(dish)) {
    throw new Error("The dish could not be displayed.");
  }

  const card = createElement(
    "article",
    undefined,
    "dish-card"
  );

  const focusLabel = onPeriod
    ? "PERIOD SUPPORT ON"
    : "BASED ON YOUR KITCHEN";

  const generationLabel = generatedWithAI
    ? "AI GENERATED"
    : "BASIC MATCH";

  card.append(
    createElement(
      "p",
      focusLabel + " · " + generationLabel,
      "eyebrow"
    ),

    createElement("h3", dish.name),

    createElement("p", dish.note, "dish-note")
  );

  if (dish.uses.length > 0) {
    appendIngredientSection(
      card,
      "From your kitchen",
      dish.uses
    );
  } else {
    card.append(
      createElement(
        "p",
        "No usable ingredient matches were identified.",
        "hint"
      )
    );
  }

  if (dish.extras.length > 0) {
    appendIngredientSection(
      card,
      "You’ll also need",
      dish.extras,
      "missing"
    );
  } else {
    card.append(
      createElement(
        "p",
        "No extra ingredients listed. Check that you have enough " +
        "for your portion.",
        "hint"
      )
    );
  }

  resultElement.replaceChildren(card);

  previousName = dish.name;
  buttonLabel.textContent = "Suggest another dish";

  statusElement.textContent = onPeriod
    ? "Suggestion updated using your ingredients and period support."
    : "Your dish suggestion is ready.";
}

// --------------------------------------------------
// Loading state
// --------------------------------------------------

function setLoading(loading) {
  isGenerating = loading;

  generateButton.disabled = loading;
  ingredientInput.disabled = loading;
  periodToggle.disabled = loading;

  form.setAttribute("aria-busy", String(loading));

  buttonLabel.textContent = loading
    ? "Finding a dish…"
    : previousName
      ? "Suggest another dish"
      : "Suggest a dish";
}

// --------------------------------------------------
// Generate or regenerate
// --------------------------------------------------

async function generateDish() {
  if (isGenerating) {
    return;
  }

  const ingredients = ingredientInput.value.trim();

  if (parseIngredients(ingredients).size === 0) {
    statusElement.textContent =
      "Add your ingredients first, then suggest a dish.";

    ingredientInput.focus();
    return;
  }

  const onPeriod = periodToggle.checked;

  setLoading(true);

  statusElement.textContent = onPeriod
    ? "Finding a dish using your ingredients and period preferences…"
    : "Finding a dish using your ingredients…";

  try {
    await availabilityCheck;

    let dish;

    if (aiReady) {
      dish = await requestAIDish(ingredients, onPeriod);
    } else {
      dish = createBasicSuggestion(ingredients, onPeriod);
    }

    displayDish(dish, onPeriod, aiReady);
  } catch (error) {
    statusElement.textContent =
      error.message ||
      "Something went wrong. Please try again.";
  } finally {
    setLoading(false);
  }
}

// Main button
form.addEventListener("submit", event => {
  event.preventDefault();
  generateDish();
});

// Switching period support on OR off regenerates the suggestion.
// It always uses the current ingredient list.
periodToggle.addEventListener("change", () => {
  generateDish();
});














