import React, { useState } from 'react';
import ForgeReconciler, {
  Text, Box, Button, Checkbox, Form, FormSection, FormFooter, Heading, Label, Stack, Textfield, useForm, DynamicTable, RadioGroup 
} from '@forge/react';
import { invoke } from '@forge/bridge';

const Admin = () => {
  const [questions, setQuestions] = useState([]);
  const [quizName, setQuizName] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [rows, setRow] = useState([]);
  const { handleSubmit, register, getFieldId } = useForm();
  const [showForm, setShowForm] = useState(false);
  const [showQuizName, setShowQuizName] = useState(false);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);

  // Function to add a new question to the quiz
  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question: '', 
        type: 'radio',
        choices: [''], 
        correctAnswers: [] 
      }
    ]);
  };

  // Function to remove a specific question by index
  const removeQuestion = (index) => {
    const updatedQuestions = questions.filter((_, qIndex) => qIndex !== index);
    setQuestions(updatedQuestions);
  };

  // Function to update a specific question's attribute (question text, type, etc.)
  const updateQuestion = (index, key, value) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index][key] = value;
    setQuestions(updatedQuestions);
  };

  // Function to update the choice text for a given question and choice index
  const updateChoice = (questionIndex, choiceIndex, value) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].choices[choiceIndex] = value;
    setQuestions(updatedQuestions);
  };

  // Function to add a new choice to a specific question
  const addChoice = (index) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index].choices.push('');
    setQuestions(updatedQuestions);
  };

  // Function to remove a specific choice from a question
  const removeChoice = (questionIndex, choiceIndex) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].choices = updatedQuestions[questionIndex].choices.filter((_, cIndex) => cIndex !== choiceIndex);
    setQuestions(updatedQuestions);
  };

  // Function to toggle whether a choice is marked as correct for a question
  const toggleCorrectAnswer = (questionIndex, choiceIndex) => {
    const updatedQuestions = [...questions];
    const { correctAnswers, type, choices } = updatedQuestions[questionIndex];
    const correctAnswerText = choices[choiceIndex];

    // Prevent empty choices from being marked as correct
    if (correctAnswerText.trim() === "") {
      return;
    }

    if (type === 'radio') {
      updatedQuestions[questionIndex].correctAnswers = [correctAnswerText]; 
    } else {
      const isCorrect = correctAnswers.includes(correctAnswerText);
      updatedQuestions[questionIndex].correctAnswers = isCorrect
        ? correctAnswers.filter((answer) => answer !== correctAnswerText)
        : [...correctAnswers, correctAnswerText]; 
    }
    setQuestions(updatedQuestions);
  };

  // Function to submit the quiz questions to the backend
  const submitQuestions = async () => {
    const formattedQuestions = questions.map(({ question, choices, correctAnswers, type }) => {
      const updatedCorrectAnswers = correctAnswers.filter(answer => {
        return choices.includes(answer.trim()) && answer.trim() !== "";
      });

      return {
        question,
        choices,
        correctAnswer: updatedCorrectAnswers,
        type,
      };
    });

    const quizData = {
      quizName,
      quiz: formattedQuestions, 
      result: [] 
    };

    try {
      // Send the quiz data to the server for saving
      const response = await invoke('saveQuizQuestions', { questions: quizData });

      if (response.error) {
        throw new Error(response.error);
      }

      // Show the pageId in case the saving is successful
      console.log(response.pageId);
      const successText = `Questions saved successfully! \n pageID: ${response.pageId}`;
      alert(successText); 
    } catch (error) {
      console.error('Error saving questions:', error);
      alert('There was an error saving your questions. Please try again.');
    }
  };

  // Helper function to generate a unique key for each quiz name
  const createKey = (input) => {
    return input ? input.replace(/^(the|a|an)/i, "").replace(/\s/g, "") : input;
  };

  // Function to format quizzes into rows for display in a table
  const generateRows = (quizzes) => {
    return quizzes.map((quiz, quizIndex) => ({
      key: `row-${quizIndex}-${quiz.quizName}`,
      cells: [
        {
          key: createKey(quiz.quizName),
          content: quiz.quizName,
        },
        {
          key: `questions-${quizIndex}`,
          content: quiz.quiz
            .map(
              (question, qIndex) =>
                `Q${qIndex + 1}: ${question.question} (Choices: ${question.choices.join(", ")})`
            )
            .join("; "),
        },
        {
          key: `results-${quizIndex}`,
          content: quiz.results.length
            ? JSON.stringify(quiz.results, null, 2)
            : "No results yet",
        },
      ],
    }));
  };

  // Header configuration for the table
  const head = {
    cells: [
      {
        key: "quizName",
        content: "Quiz Name",
        isSortable: true,
      },
      {
        key: "questions",
        content: "Questions",
        shouldTruncate: true,
        isSortable: false,
      },
      {
        key: "results",
        content: "Results",
        shouldTruncate: true,
        isSortable: false,
      },
    ],
  };

  // Function to fetch all quizzes from the backend
  const fetchQuizzes = async () => {
    setLoadingQuizzes(true);
    try {
      const response = await invoke('getQuizes'); 
      console.log(response);
      if (response.error) {
        throw new Error(response.error);
      }
      setQuizzes(response.quizzes); 
      setRow(generateRows(response.quizzes)); 
      setShowQuestions(true); 
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      alert('There was an error fetching quizzes. Please try again.');
    } finally {
      setLoadingQuizzes(false);
    }
  };

  return (
    <Form onSubmit={handleSubmit(submitQuestions)}>
      <Box>
        <FormSection>
          <Stack space="space.400">
            <Heading as="h1">Quiz Admin</Heading>

            {/* Button to show the quiz creation form */}
            <Button onClick={() => {
              setShowForm(true); 
              setShowQuizName(true); 
            }} appearance="primary">Create Quiz</Button>

            {/* Button to show the list of all quizzes */}
            <Button onClick={() => {
              setShowForm(false); 
              setShowQuizName(false); 
              fetchQuizzes();
            }} appearance="secondary">Show All Questions</Button>

            {/* Quiz name input field */}
            {showQuizName && (
              <Box>
                <Label labelFor="quizName">Quiz Name</Label>
                <Textfield
                  id="quizName"
                  value={quizName}
                  onChange={(e) => setQuizName(e.target.value)}
                  placeholder="Enter the quiz name"
                />
              </Box>
            )}

            {/* Quiz creation form */}
            {showForm && (
              <Box>
                {questions.map((question, qIndex) => (
                  <Box key={qIndex}>
                    <Heading as="h3">Question {qIndex + 1}</Heading>
                    <Textfield
                      id={getFieldId(`question-${qIndex}`)}
                      value={question.question}
                      onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                      placeholder="Enter question"
                    />
                    <RadioGroup
                      name={`type-${qIndex}`}
                      options={[{ label: 'Single Choice', value: 'radio' }, { label: 'Multiple Choice', value: 'checkbox' }]}
                      value={question.type}
                      onChange={(e) => updateQuestion(qIndex, 'type', e.target.value)}
                    />
                    <Box marginTop="space.300">
                      <Heading as="h4">Choices</Heading>
                      {question.choices.map((choice, cIndex) => (
                        <Box key={cIndex}>
                          <Textfield
                            value={choice}
                            onChange={(e) => updateChoice(qIndex, cIndex, e.target.value)}
                            placeholder={`Choice ${cIndex + 1}`}
                            width="medium"
                          />
                          <Checkbox
                            isChecked={question.correctAnswers && question.correctAnswers.includes(choice)}
                            onChange={() => toggleCorrectAnswer(qIndex, cIndex)}
                            label="Correct"
                          />
                          <Button
                            appearance="subtle"
                            iconBefore="trash"
                            onClick={() => removeChoice(qIndex, cIndex)}
                          >
                            Remove
                          </Button>
                        </Box>
                      ))}
                    </Box>
                    <Button appearance="subtle-link" onClick={() => addChoice(qIndex)}>
                      + Add Choice
                    </Button>
                    <Button
                      appearance="danger"
                      iconBefore="trash"
                      onClick={() => removeQuestion(qIndex)}
                    >
                      Delete Question
                    </Button>
                  </Box>
                ))}

                <Button appearance="primary" onClick={addQuestion}>+ Add Question</Button>

                <FormFooter>
                  <Button type="submit" appearance="primary">Save Questions</Button>
                </FormFooter>
              </Box>
            )}

            {/* Show all quizzes in a table */}
            {showQuestions && !showForm && (
              <Box>
                <Heading as="h3">All Quizzes</Heading>
                {loadingQuizzes ? (
                  <Text>Loading quizzes...</Text>
                ) : (
                  <DynamicTable
                    caption="List of Quizzes"
                    head={head}
                    rows={rows}
                    rowsPerPage={10}
                    defaultPage={1}
                  />
                )}
              </Box>
            )}
          </Stack>
        </FormSection>
      </Box>
    </Form>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <Admin />
  </React.StrictMode>
);
