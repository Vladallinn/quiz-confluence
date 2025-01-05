import Resolver from '@forge/resolver';
import api, { route } from "@forge/api";

const resolver = new Resolver();

let questions = [];  
let globalQuizId = '';  


// It checks if both arrays are of the same length and have the same values at each index
const arraysEqual = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

// Helper function to escape HTML content
const escapeHTML = (str) => str
  .replace(/&/g, '&amp;')    
  .replace(/</g, '&lt;')     
  .replace(/>/g, '&gt;')     
  .replace(/"/g, '&quot;')   
  .replace(/'/g, '&#39;');   

// Define HTML replacements for easier reuse in the code
const HTML_REPLACEMENTS = {
  removePTags: /<\/?p>/g,    
  replaceQuotes: /&quot;/g,  
};

// Fetch quiz questions from Confluence
resolver.define('getQuizQuestions', async (req) => {
  try {
    const { quizId } = req.payload;  
    globalQuizId = quizId;  

    // Make a GET request to fetch the quiz page data from Confluence
    const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${quizId}?body-format=storage`, {
      headers: { 'Accept': 'application/json' },
    });

    // Handle errors if the request fails
    if (!response.ok) {
      console.error(`Failed to fetch quiz questions: ${response.status} ${response.statusText}`);
      return { error: 'Unable to fetch quiz questions.' };
    }

    // Parse the Confluence page data and extract the body content
    const pageData = await response.json();
    const bodyValue = pageData.body?.storage?.value;

    if (!bodyValue) {
      return { error: 'No content found in the page.' };
    }

    // Clean the body content by removing <p> tags and replacing &quot; with quotes
    const jsonResult = bodyValue
      .replace(HTML_REPLACEMENTS.removePTags, '')
      .replace(HTML_REPLACEMENTS.replaceQuotes, '"');

    // Parse the cleaned content into a JSON object and extract the quiz questions
    questions = JSON.parse(jsonResult).quiz || [];
    return { questions };  
  } catch (err) {
    // Handle unexpected errors
    console.error('Error fetching quiz questions:', err);
    return { error: 'Unexpected error occurred while fetching quiz questions.' };
  }
});

// Validate user's answer to a specific question
resolver.define('validateAnswer', (req) => {
  try {
    const { questionIndex, selectedAnswer } = req.payload;  
    const question = questions[questionIndex];  

    // Check if the question exists
    if (!question) {
      return { error: 'Invalid question index.' };
    }

    let isCorrect = false;
    let feedback = '';

    // Check if the answer is correct based on the question type (radio or checkbox)
    if (question.type === 'radio') {
      isCorrect = arraysEqual(selectedAnswer, question.correctAnswer); 
    } else if (question.type === 'checkbox') {
      const correctSet = new Set(question.correctAnswer);
      const selectedSet = new Set(selectedAnswer);
      isCorrect = correctSet.size === selectedSet.size && [...correctSet].every(answer => selectedSet.has(answer));
    }
    feedback = isCorrect ? 'Correct!' : 'Wrong! Try again.';
    return { isCorrect, feedback }; 
  } catch (err) {
    // Handle unexpected errors during answer validation
    console.error('Error validating answer:', err);
    return { error: 'Unexpected error occurred during validation.' };
  }
});

// Save result back to Confluence after the quiz is completed
resolver.define('getResult', async (req) => {
  try {
    const resultPayload = req.payload;  

    // Make a GET request to fetch the current page data from Confluence
    const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${globalQuizId}?body-format=storage`, {
      headers: { 'Accept': 'application/json' },
    });

    // Handle errors if the request fails
    if (!response.ok) {
      console.error(`Failed to fetch page: ${response.status} ${response.statusText}`);
      return { error: 'Unable to fetch Confluence page.' };
    }

    // Parse the page data and extract the body content
    const pageData = await response.json();
    const { id: pageId, status, title, body, version } = pageData;
    const bodyValue = body?.storage?.value;

    if (!bodyValue) {
      return { error: 'No content found in the page body.' };
    }

    // Clean and parse the content from the page body
    let jsonResult = bodyValue
      .replace(HTML_REPLACEMENTS.removePTags, '')
      .replace(HTML_REPLACEMENTS.replaceQuotes, '"');

    let parsedData;
    try {
      parsedData = JSON.parse(jsonResult);  
    } catch (err) {
      console.error('Error parsing JSON:', err);
      return { error: 'Failed to parse JSON content.' };
    }

    // Update the results in the parsed data
    const results = parsedData.result || [];
    results.push(resultPayload); 
    parsedData.result = results;

    // Prepare the updated content for the Confluence page
    const escapedBodyValue = `<p>${escapeHTML(JSON.stringify(parsedData))}</p>`;
    const updatedPageData = JSON.stringify({
      id: pageId,
      status,
      title,
      body: {
        representation: 'storage',  
        value: escapedBodyValue,
      },
      version: {
        number: version.number + 1,  
        message: 'Updated quiz results',  
      },
    });

    // Make a PUT request to update the Confluence page with the new results
    const updateResponse = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: updatedPageData,
    });

    // Handle errors if the update request fails
    if (!updateResponse.ok) {
      console.error(`Failed to update page: ${updateResponse.status} ${updateResponse.statusText}`);
      return { error: 'Failed to update Confluence page.' };
    }

    return { success: true, message: 'Page updated successfully.' };  
  } catch (err) {
    // Handle unexpected errors during the result update
    console.error('Unexpected error:', err);
    return { error: 'An unexpected error occurred.' };
  }
});

export const handler = resolver.getDefinitions(); 
