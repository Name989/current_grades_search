const { Client } = require('pg');
const axios = require('axios');
const { getAccessToken } = require('./auth.js'); // Assuming you have an auth.js file for obtaining access token
const config = require('./config.json');

const postgresCredentials = config.postgresCredentials;


// Function to fetch data from the API and upsert it into the PostgreSQL database
async function fetchDataAndUpsertIntoPostgreSQL() {
    try {
        const accessToken = await getAccessToken(); // Obtaining the access token
        const schoolDBNs = await fetchSchoolDBNs();
        console.log('Token-', accessToken);

        for (const schoolDBN of schoolDBNs) {
            console.log('schoolDBN', schoolDBN);
            try {
                const response = await axios.get('https://api.schools.nyc/doe/prd/v1/courses/current-grades-search', {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        serviceAccountID: 'service.SolvCon'
                    },
                    params: {
                        locationCode: schoolDBN,
                        
                    }
                });

                const data = response.data;

                await upsertDataIntoPostgreSQL(data);
            } catch (error) {
                console.error(`Error fetching data for schoolDBN ${schoolDBN} and upserting into PostgreSQL:`, error);
            }
        }
    } catch (error) {
        console.error('Error fetching school DBNs from PostgreSQL:', error);
    }
}

// Function to fetch school DBNs from the PostgreSQL database
async function fetchSchoolDBNs() {
    const client = new Client(postgresCredentials);
    try {
        await client.connect();
        const query = 'SELECT DISTINCT school_dbn FROM nyc_doe_dbn'; // Adjust query as per your table structure
        const result = await client.query(query);
        return result.rows.map(row => row.school_dbn);
    } catch (error) {
        console.error('Error fetching school DBNs from PostgreSQL:', error);
        return [];
    } finally {
        await client.end();
    }
}

// Function to upsert data into the PostgreSQL database
async function upsertDataIntoPostgreSQL(data) {
    const client = new Client(postgresCredentials);
    try {
        await client.connect();

        // Check if data contains item property and it's iterable
        if (!data || !data.item || !Array.isArray(data.item)) {
            console.log('data.item', data.item);
            throw new Error('Invalid API response: Item data is missing or not iterable');
        }

        // Iterate over each item in the response
        for (const item of data.item) {
            if (!item.schools || !Array.isArray(item.schools)) {
                throw new Error('Invalid API response: Schools data is missing or not iterable');
            }

            // Iterate over schools for each item
            for (const school of item.schools) {
                const { schoolDBN, courses } = school;
                console.log('Data--', school.schoolDBN);
                for (const course of courses) {
                    const { id: course_id, courseCode, schoolYear, termID, sections } = course;
                    for (const section of sections) {
                        const { id: section_id, sectionID: sub_section_id, markingPeriodGrades } = section;
                        for (const grade of markingPeriodGrades) {
                            const { credits: marking_period_credit, markingPeriod } = grade;
                                            
                            const course_term_id = `${section_id}-${termID}-${markingPeriod}`;
                            const query = {
                                text: `
                                    INSERT INTO current_grade_search 
                                        (course_term_id, school_dbn, course_code, course_id, school_year, term_id, section_id, sub_section_id, marking_period_credit, marking_period) 
                                    VALUES 
                                        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                                    ON CONFLICT (course_term_id) DO NOTHING;
                                `,
                                values: [
                                    course_term_id,
                                    schoolDBN,
                                    courseCode,
                                    course_id,
                                    schoolYear,
                                    termID,
                                    section_id,
                                    sub_section_id,
                                    marking_period_credit,
                                    markingPeriod
                                ],
                            };
                            await client.query(query);
                        }
                    }
                }
            }
        }
        console.log('Data upserted into PostgreSQL successfully.');
    } catch (error) {
        console.error('Error upserting data into PostgreSQL:', error);
    } finally {
        await client.end();
    }
}


// Main function to run the process
async function main() {
    await fetchDataAndUpsertIntoPostgreSQL();
}

// Call the main function
main();
