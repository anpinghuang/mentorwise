// setup express
const express = require('express'); // for running the website

//setup additional stuff
const bodyParser = require('body-parser'); // for parsing variables
const session = require('express-session'); // for storing and passing variables
const crypto = require('crypto'); // for generating unique session
const ejs = require('ejs'); // for sending variables
const axios = require('axios'); // for making HTTP requests to chatgpt


// make app
const app = express();
const port = 3000;

// page setups
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs'); // Set EJS as the view engine (for sending variables)
// also knows that .ejs files are in "views" folder by default
app.use(express.static('public'));


// code
const secretKey = crypto.randomBytes(64).toString('hex');
console.log(secretKey);
app.use(session({
    secret: secretKey,
    resave: false,
    saveUninitialized: true,
  }));

// HOME PAGE --------------------------------------------------------------------
app.get('/', (req, res) => { 
    res.render("index");
});

// END OF HOME PAGE --------------------------------------------------------------------

app.post('/submit', (req, res) => { 
    const userInput = req.body.userInput;
    const time = req.body.time;

    // checks if input is iframe
    if (!userInput.startsWith('<iframe')) {
        // Set errorMessage and re-render the form (insert back whatever variables you inserted for app.get("/") )
        res.render('index', { errorMessage: 'This is not an iframe code. Please provide an iframe code.' }); 
        return;
    }
    if (isNaN(parseInt(time))) {
        // Set errorMessage and re-render the form (insert back whatever variables you inserted for app.get("/") )
        res.render('index', { errorMessage2: 'Please input time as a number' }); 
        return;
    }
    const srcValue = userInput.match(/src="([^"]*)"/)[1]; // gets the srcvalue from userinput
    // Store srcValue and time in the session
    req.session.srcValue = srcValue;
    req.session.time = time;
    // Redirect to the meeting page
    res.redirect('/meeting');
});

// 2nd PAGE ----------------------------------------------------------------------------

app.get('/meeting', (req, res) => {
    // Retrieve userInput from the session
    const srcValue = req.session.srcValue;
    const time = req.session.time;
  
    // Render the result page with the user input
    //res.send(`You entered: ${userInput}`);
    res.render("meeting", {srcValue, time});
});

// END OF 2nd PAGE ---------------------------------------------------------------------------


app.use(bodyParser.text()); // must have this to parse the text
// GET TRANSCRIPT  &  use chatgpt
app.post('/getTranscript', (req, res) => { // have to include asyn before (req,res) to run async functions
    const myTranscript = req.body;
    console.log('Received variable from EJS:', myTranscript);
    
    // CHATGPT
    const apiKey = 'process.env.OPENAI_API_KEY'; // App might not run because disabled kei
    const apiUrl = 'https://api.openai.com/v1/chat/completions';

    async function getChatCompletion(prompt) {
        try {
        const response = await axios.post(
            apiUrl,
            {
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: prompt },
            ],
            },
            {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            }
        );
    
        const completion = response.data.choices[0].message.content;
        console.log('ChatGPT Response:', completion);
        return completion;
        // find OVERALL_RESPONSE and PRESENTOR_GRADE from response, then store it in session
        // Define the keywords you want to find
        
        } catch (error) {
        console.error('Error:', error.message);
        }
    }
    
    // Example usage
    const userPrompt = `You are a professional presentor trainer aimed to improve presentations. I will give you a transcript of a presentor's voice recording during a presentation. Please give feedback on the presentation based on whether the presentor greeted their audience, the presented information's accuracy, logical flow of ideas, relevency, and simplicity.  In addition, you will be giving them a grade from 0-100 based on the given transcript only, and a 1-2 sentence summary of your feedback in the format: PRESENTOR_GRADE: [given_grade], SUMMARY: [1-2-sentence-summary], DETAILED_FEEDBACK: [your detailed feedback on the presentation].  Also, please don't say any other words besides your feedback. Thank you, and here is the transcript:  ${myTranscript}`;
    // get response and store in session
    getChatCompletion(userPrompt).then(result => {
        // Define regular expressions for each piece of data
        const presentorGradeRegex = /PRESENTOR_GRADE: (\d+)/;
        const summaryRegex = /SUMMARY: ([^]+?)\bDETAILED_FEEDBACK:/;
        const detailedFeedbackRegex = /DETAILED_FEEDBACK: ([\s\S]+)/;

        // Extract data using regular expressions
        const presentorGradeMatch = result.match(presentorGradeRegex);
        const summaryMatch = result.match(summaryRegex);
        const detailedFeedbackMatch = result.match(detailedFeedbackRegex);

        // Get the captured groups
        const presentorGrade = presentorGradeMatch ? presentorGradeMatch[1] : null;
        const summary = summaryMatch ? summaryMatch[1].trim() : null;
        const detailedFeedback = detailedFeedbackMatch ? detailedFeedbackMatch[1].trim() : null;

        // Log the results
        req.session.presentorGrade = presentorGrade;
        req.session.summary = summary;
        req.session.detailedFeedback = detailedFeedback;

        // Instead of res.redirect('/my_results');
        res.send({ redirectTo: 'results' }); // fixes redirect bug by telling javascript to redirect instead
    });
});


// START OF RESULTS PAGE

app.get('/results', (req, res) => {
    try {
        const overallSummary = req.session.summary;
        const presentorGrade = req.session.presentorGrade;
        const detailedFeedback = req.session.detailedFeedback;
        console.log("OVERALL SUMMARY IN RESULTS!!:",overallSummary);
        console.log("OVERALL GRADE IN RESULTS!!: ",presentorGrade);
        console.log("DETAILED FEEDBACK in results: ",detailedFeedback);
        res.render("results",{overallSummary,presentorGrade, detailedFeedback});
    } catch (error) {
        console.error('Error rendering result.ejs:', error);
        res.status(500).send('Internal Server Error');
    }
});

// END OF RESULTS PAGE

app.listen(process.env.PORT || port, () => console.log(`Listening on port ${port}`))
