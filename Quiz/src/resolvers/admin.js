import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';


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

const resolver = new Resolver();

// Define the resolver function for saving quiz questions
resolver.define('saveQuizQuestions', async ({ payload }) => {
  const { questions } = payload;
  const { quizName, quiz } = questions; 

  // Validate the quiz array: it must be an array and should not be empty
  if (!Array.isArray(quiz) || quiz.length === 0) {
    return { error: 'Invalid or empty quiz array' };
  }

  const quizTitle = quizName.trim() ? quizName : "Quiz";

  // Format the questions to escape HTML and remove unwanted <p> tags
  const formattedQuestions = quiz.map((question) => ({
    question: escapeHTML(question.question).replace(HTML_REPLACEMENTS.removePTags, ''),
    choices: question.choices.map(choice => escapeHTML(choice).replace(HTML_REPLACEMENTS.removePTags, '')),
    correctAnswer: question.correctAnswer.map(answer => escapeHTML(answer).replace(HTML_REPLACEMENTS.removePTags, '')),
    type: question.type,
  }));

  // Create the body data for the API request to save the quiz
  const bodyData = JSON.stringify({
    spaceId: "65866", 
    status: "current", 
    title: quizTitle, 
    body: {
      representation: "storage",  
      value: JSON.stringify({
        quiz: formattedQuestions, 
        result: [] 
      }),
    },
  });

  try {
    // Send a POST request to Confluence API to save the quiz
    const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: bodyData,
    });

    // Handle response errors
    if (!response.ok) {
        if(response.status == 400){
            throw new Error(`Fail to save a quiz. Use unique quiz name`);  
        }
        throw new Error(`Failed to save questions. Status: ${response.status}`);
    }

    // Parse the response data and return success with page ID
    const responseData = await response.json();
    return { success: true, pageId: responseData.id };
  } catch (error) {
    // Handle any errors that occur during the request
    console.error('Error saving questions:', error);
    return { error: error.message };
  }
});

// Define the resolver function to fetch quizzes
resolver.define('getQuizes', async (req) => { 
    try {
      const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages?body-format=storage`, {
        headers: {
          'Accept': 'application/json'
        }
      });
  
      if (response.status === 200) {
        const pages = await response.json();
        
        // Filter out pages that do not contain valid quiz data
        const validQuizzes = pages.results.filter(page => {
            try {
                const cleanedBody = page.body?.storage?.value
                  .replace(HTML_REPLACEMENTS.removePTags, '') 
                  .replace(HTML_REPLACEMENTS.replaceQuotes, '"'); 
               
                const json = JSON.parse(cleanedBody);
                
                if (json && json.quiz && Array.isArray(json.quiz)) {
                    return true; 
                } else {
                    return false; 
                }
            } catch (error) {
              return false; 
            }
          }).map(page => {
            // Process the valid quizzes and return the necessary data
            const cleanedBody = page.body?.storage?.value
              .replace(HTML_REPLACEMENTS.removePTags, '')  
              .replace(HTML_REPLACEMENTS.replaceQuotes, '"'); 
            
            const json = JSON.parse(cleanedBody); 
            return {
              id: page.id,
              quizName: page.title,
              quiz: json.quiz, 
              results: json.result 
            };
          });
        return {
            quizzes: validQuizzes,
        };
      } else {
        // Handle failure to fetch quizzes
        console.error('Failed to fetch quizzes from Confluence:', response.status);
        return { status: response.status, body: { error: 'Failed to fetch quizzes' } };
      }
    } catch (error) {
      // Handle errors during the API request
      console.error('Error fetching quizzes:', error);
      return { status: 500, body: { error: 'Internal server error' } };
    }
  });

export const handler = resolver.getDefinitions();
