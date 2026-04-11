// @ts-nocheck
import * as fs from 'fs';
import * as path from 'path';
import { program } from 'commander';
import { CourseHelpers, CourseData } from './CourseData';
import { RaceSolverBuilder } from './RaceSolverBuilder';
import { Strategy, Aptitude } from './HorseTypes';

program
    .option('--speed <number>', 'Speed stat', '1200')
    .option('--stamina <number>', 'Starting stamina stat', '600')
    .option('--power <number>', 'Power stat', '900')
    .option('--guts <number>', 'Guts stat', '500')
    .option('--wisdom <number>', 'Wisdom stat', '900')
    .option('--distMod <number>', 'Distance proficiency modifier (e.g. 1.00 or 1.05)', '1.05');

program.parse();
const opts = program.opts();

const INPUT_SPEED = parseInt(opts.speed, 10);
const START_STAMINA = parseInt(opts.stamina, 10);
const INPUT_POWER = parseInt(opts.power, 10);
const INPUT_GUTS = parseInt(opts.guts, 10);
const INPUT_WISDOM = parseInt(opts.wisdom, 10);
const DIST_MOD = parseFloat(opts.distMod);
const DIST_APTITUDE = DIST_MOD >= 1.05 ? Aptitude.S : Aptitude.A;


const umalatorGlobalCoursePath = path.join(__dirname, '../umalator-global/course_data.json');
const courseDataRaw = JSON.parse(fs.readFileSync(umalatorGlobalCoursePath, 'utf8'));

const strategies = [
    { name: 'Senkou', strategyId: Strategy.Senkou, coeff: 0.89 },
    { name: 'Oikomi', strategyId: Strategy.Oikomi, coeff: 0.995 }
];

const TARGET_SPURT_RATE = 0.90;
const TARGET_SURVIVAL_RATE = 0.80;
const NSAMPLES = 5000;
const STAMINA_STEP = 50;
const MAX_STAMINA = 2500;

function testStamina(course: CourseData, strategy: Strategy, stamina: number): { spurtRate: number, survivalRate: number } {
    let fullSpurtCount = 0;
    let survivalCount = 0;

    for (let i = 0; i < NSAMPLES; i++) {
        const b = new RaceSolverBuilder(1)
            .seed(i + 1)
            .course(course)
            .ground(4)
            .mood(2)
            .mode('compare')
            .horse({
                speed: INPUT_SPEED,
                stamina: stamina,
                power: INPUT_POWER,
                guts: INPUT_GUTS,
                wisdom: INPUT_WISDOM,
                strategy: strategy,
                distanceAptitude: DIST_APTITUDE,
                surfaceAptitude: Aptitude.S,
                strategyAptitude: Aptitude.A,
                mood: 2,
                skills: []
            })
            .withStaminaSyoubu();

        const solver = b.build().next().value;
        solver.initUmas([]);
        const dt = 1 / 15;

        while (solver.pos < course.distance) {
            solver.step(dt);
        }
        solver.cleanup();

        if (solver.fullSpurt) fullSpurtCount++;
        if (!solver.hpDied) survivalCount++;

        // At the 500th increment (i = 499), exit early if the spurt rate is less than 60%
        if (i === 499) {
            if (fullSpurtCount / 500 < 0.60) {
                return { spurtRate: 0, survivalRate: 0 };
            }
        }
    }

    return {
        spurtRate: fullSpurtCount / NSAMPLES,
        survivalRate: survivalCount / NSAMPLES
    };
}

const results = {};

console.log("Starting analysis of all courses...");
const entries = Object.entries(courseDataRaw);
let processedCount = 0;

for (const [courseId, courseObj] of entries) {
    let course: CourseData;
    try {
        course = CourseHelpers.getCourse(parseInt(courseId));
    } catch (e) {
        // Skip invalid courses
        continue;
    }

    // Only calculate for courses >= 2000m
    if (course.distance < 1600) {
        continue;
    }

    processedCount++;
    console.log(`Processing course ${courseId} (${course.distance}m)... [${processedCount} courses tested]`);

    results[courseId] = { distance: course.distance, label: `Course ${courseId}` };

    const courseLogs = [];

    for (const strat of strategies) {
        let currentStamina = START_STAMINA;
        let success = false;
        let finalStats = { spurtRate: 0, survivalRate: 0 };

        while (currentStamina <= MAX_STAMINA) {
            finalStats = testStamina(course, strat.strategyId, currentStamina);
            if (finalStats.spurtRate >= TARGET_SPURT_RATE && finalStats.survivalRate >= TARGET_SURVIVAL_RATE) {
                results[courseId][strat.name] = currentStamina;
                success = true;
                break;
            }

            currentStamina += STAMINA_STEP;
        }

        if (!success) {
            results[courseId][strat.name] = -1;
        }

        courseLogs.push(`  - ${strat.name}: Stamina = ${results[courseId][strat.name]}, Spurt = ${(finalStats.spurtRate * 100).toFixed(1)}%, Survival = ${(finalStats.survivalRate * 100).toFixed(1)}%`);
    }

    console.log(courseLogs.join('\n'));

    // Save results incrementally per course to prevent data loss
    const outputPath = path.join(__dirname, 'stamina_results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
}

console.log(`Analysis complete! Results written to stamina_results.json`);
