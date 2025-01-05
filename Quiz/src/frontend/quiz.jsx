import React, { useState, useEffect } from 'react';
import ForgeReconciler, { 
  Text, Box, Button, Checkbox, RadioGroup, Form, FormSection, 
  FormFooter, Heading, Label, Stack, Textfield, ErrorMessage, useForm 
} from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answerStatus, setAnswerStatus] = useState(''); 
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false); 
  const [loading, setLoading] = useState(false); 
  const [isAnswering, setIsAnswering] = useState(false); 
  
  const { handleSubmit, register, formState, getFieldId } = useForm();

  // Function to send results to backend
  const sendResultsToBackend = async () => {
    try {
      const resultData = {
        score, 
        totalQuestions: questions.length, 
        timestamp: new Date().toISOString(), 
      };

      await invoke('getResult', resultData); 
      console.log("Results successfully sent to backend.");
    } catch (error) {
      console.error("Error sending results to backend:", error);
    }
  };

  // Handle the submission of the ID and start the quiz
  const startQuiz = async (data) => {
    const { quizId } = data; 
    if (!quizId) {
      setAnswerStatus('Please enter a valid quiz ID');
      return;
    }
    setAnswerStatus(''); 
    setLoading(true);
    try {
      const response = await invoke('getQuizQuestions', { quizId }); 
      if (response.error) {
        throw new Error(response.error);
      }
      setQuestions(response.questions);
      setQuizStarted(true);
    } catch (error) {
      console.error("Error fetching quiz questions:", error);
      setAnswerStatus('Error fetching quiz questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle the submission of answers
  const handleQuizSubmit = async (data) => {
    setIsAnswering(true); 

    // Collect the selected answers
    const selectedAnswerData = questions[currentQuestionIndex].type === "radio" 
      ? [data.answer] 
      : Object.keys(data.answers).filter(key => data.answers[key]);

    const { isCorrect } = await invoke('validateAnswer', {
      questionIndex: currentQuestionIndex,
      selectedAnswer: selectedAnswerData,
    });

    if (isCorrect) {
      setScore(score + 1);
      setAnswerStatus('Correct');
    } else {
      setAnswerStatus('Wrong');
    }

    // Move to the next question after displaying the answer status
    if (currentQuestionIndex < questions.length - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setAnswerStatus(''); 
        setIsAnswering(false); 
      }, 1000); 
    } else {
      setQuizFinished(true); 
      setAnswerStatus('');  
      sendResultsToBackend(); 
    }
  };

  if (questions.length === 0 && quizStarted) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
        <Text>Loading quiz...</Text>
      </Box>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  // Calculate the percentage of correct answers
  const correctPercentage = (score / questions.length) * 100;
  const fail = `Sorry, you have failed this attempt. It included ${questions.length} questions.\n 
                To pass it, you needed to answer 90% questions correctly. 
                Your score is ${correctPercentage.toFixed(2)}% (${score} questions out of ${questions.length}).`
  const pass = `Congratulations! You have successfully passed the quiz. It included ${questions.length} questions. \n
                To pass it, you needed to answer 90% of questions correctly. \n
                Your score is ${correctPercentage.toFixed(2)}% (${score} questions out of ${questions.length}).`
  const completionMessage = correctPercentage >= 90 
    ? pass 
    : fail;

  // Choose background color based on percentage
  const backgroundColor = correctPercentage >= 90
    ? "color.background.success"
    : "color.background.danger";

  return (
    <Form onSubmit={quizStarted ? handleSubmit(handleQuizSubmit) : handleSubmit(startQuiz)}>
      <Box>
        <FormSection>
          <Stack space="space.400">
            {!quizStarted && (
              <Box>
                <Heading as="h1">Welcome to the Quiz!</Heading>
                <Label labelFor={getFieldId("quizId")}>Enter Quiz ID</Label>
                <Textfield
                  {...register("quizId", { required: "Quiz ID is required" })}
                  id={getFieldId("quizId")}
                  placeholder="Enter quiz ID"
                />
                {formState.errors.quizId && <ErrorMessage>{formState.errors.quizId.message}</ErrorMessage>}
                <Button type="submit" appearance="primary" isLoading={loading} isDisabled={loading}>
                  Start Quiz
                </Button>
              </Box>
            )}

            {/* Display the correct/wrong status */}
            {answerStatus && (
              <Box 
                padding="space.200" 
                backgroundColor={
                  answerStatus === 'Correct' 
                    ? 'color.background.success' 
                    : answerStatus === 'Wrong' 
                    ? 'color.background.danger' 
                    : 'color.background.warning'
                }
              >
                <Text>{answerStatus}</Text>
              </Box>
            )}

            {quizStarted && !quizFinished && (
              <Box>
                <Heading as="h1">
                  {currentQuestion.question}
                </Heading>

                {/* Render different types of input based on the question type */}
                {currentQuestion.type === "radio" ? (
                  <RadioGroup
                    name="answer"
                    options={currentQuestion.choices.map(choice => ({
                      name: "answer",
                      value: choice,
                      label: choice
                    }))}
                    {...register("answer")}
                    isDisabled={isAnswering} 
                  />
                ) : (
                  currentQuestion.type === "checkbox" && currentQuestion.choices.map(choice => (
                    <Checkbox 
                      key={choice} 
                      label={choice} 
                      {...register(`answers.${choice}`)} 
                      isDisabled={isAnswering} 
                    />
                  ))
                )}
              </Box>
            )}

            {/* Display completion message if quiz is finished */}
            {quizFinished && (
              <Box padding="space.200"  backgroundColor={backgroundColor}>
                <Heading as="h4">
                {completionMessage.split('\n').map((line) => <Text>{line}</Text>)}
              </Heading>
              </Box>
            )}
          </Stack>
          {!quizFinished && quizStarted && (
                <Button type="submit" appearance="primary" isLoading={loading} isDisabled={isAnswering}>
                  Submit Answer
                </Button>
            )}
        </FormSection>

      </Box>
    </Form>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
