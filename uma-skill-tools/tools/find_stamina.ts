// @ts-nocheck
import * as fs from 'fs';
import * as path from 'path';
import { CourseHelpers, CourseData } from '../CourseData';
import { RaceSolverBuilder } from '../RaceSolverBuilder';
import { Strategy, Aptitude } from '../HorseTypes';

const umalatorGlobalCoursePath = path.join(__dirname, '../../umalator-global/course_data.json');
const courseDataRaw = JSON.parse(fs.readFileSync(umalatorGlobalCoursePath, 'utf8'));

const strategies = [
    { name: 'Senkou', strategyId: Strategy.Senkou, coeff: 0.89 },
    { name: 'Oikomi', strategyId: Strategy.Oikomi, coeff: 0.995 }
];

const TARGET_SPURT_RATE = 0.90;
const TARGET_SURVIVAL_RATE = 0.80;
const NSAMPLES = 50; // Optimized sample count for balance of speed and accuracy
const START_STAMINA = 400;
const STAMINA_STEP = 50;
const MAX_STAMINA = 3000;

function testStamina(course: CourseData, strategy: Strategy, stamina: number): { spurtRate: number, survivalRate: number } {
    let fullSpurtCount = 0;
    let survivalCount = 0;

    for (let i = 0; i < NSAMPLES; i++) {
        const b = new RaceSolverBuilder(1)
            .seed(i + 1)
            .course(course)
            .ground(0) // Good ground
            .mood(2) // +2
            .horse({
                speed: 1200,
                stamina: stamina,
                power: 1000,
                guts: 500,
                wisdom: 1000,
                strategy: strategy,
                distanceAptitude: Aptitude.A,
                surfaceAptitude: Aptitude.A,
                strategyAptitude: Aptitude.A,
                rawStamina: stamina,
                rawWisdom: 1000
            })
            .withAsiwotameru()
            .withStaminaSyoubu()
            .rushedKakari(true);

        const solver = b.build().next().value;
        const dt = 1 / 15;

        while (solver.pos < course.distance) {
            solver.step(dt);
        }
        solver.cleanup();

        if (solver.fullSpurt) fullSpurtCount++;
        if (!solver.hpDied) survivalCount++;
    }

    return {
        spurtRate: fullSpurtCount / NSAMPLES,
        survivalRate: survivalCount / NSAMPLES
    };
}

const results: any = {};

console.log("Starting analysis of all courses...");
const entries = Object.entries(courseDataRaw);
let currentIdx = 0;

for (const [courseId, courseObj] of entries) {
    currentIdx++;
    if (currentIdx % 10 === 0) {
        console.log(`Processed ${currentIdx}/${entries.length} courses...`);
    }

    const course = courseObj as CourseData;
    results[courseId] = { distance: course.distance, label: `Course ${courseId}` };

    for (const strat of strategies) {
        let currentStamina = START_STAMINA;
        let success = false;

        while (currentStamina <= MAX_STAMINA) {
            const stats = testStamina(course, strat.strategyId, currentStamina);

            if (stats.spurtRate >= TARGET_SPURT_RATE && stats.survivalRate >= TARGET_SURVIVAL_RATE) {
                results[courseId][strat.name] = currentStamina;
                success = true;
                break;
            }

            currentStamina += STAMINA_STEP;
        }

        if (!success) {
            results[courseId][strat.name] = -1; // Unable to satisfy condition
        }
    }
}

const outputPath = path.join(__dirname, 'stamina_results.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
console.log(`Analysis complete! Results written to stamina_results.json`);
