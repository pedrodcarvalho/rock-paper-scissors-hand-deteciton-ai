import '@tensorflow/tfjs-backend-webgl';
import * as mpHands from '@mediapipe/hands';

import * as handDetection from '@tensorflow-models/hand-pose-detection';

import { Camera } from './camera';
import { setupDatGui } from './option_panel';
import { STATE } from './utils/params';
import { setBackendAndEnvFlags } from './utils/util';

let detector, camera, lastPanelUpdate, rafId;

const createDetector = async () => {
    const runtime = 'mediapipe';

    switch (STATE.model) {
        case handDetection.SupportedModels.MediaPipeHands:
            return handDetection.createDetector(STATE.model, {
                runtime,
                modelType: STATE.modelConfig.type,
                maxHands: STATE.modelConfig.maxNumHands,
                solutionPath: `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${mpHands.VERSION}`
            });
        default:
            throw new Error(`Model ${STATE.model} is not supported.`);
    }
};

const checkGuiUpdate = async () => {
    if (STATE.isTargetFPSChanged || STATE.isSizeOptionChanged) {
        camera = await Camera.setupCamera(STATE.camera);
        STATE.isTargetFPSChanged = false;
        STATE.isSizeOptionChanged = false;
    }

    if (STATE.isModelChanged || STATE.isFlagChanged || STATE.isBackendChanged) {
        STATE.isModelChanged = true;

        window.cancelAnimationFrame(rafId);

        if (detector != null) {
            detector.dispose();
        }

        if (STATE.isFlagChanged || STATE.isBackendChanged) {
            await setBackendAndEnvFlags(STATE.flags, STATE.backend);
        }

        try {
            detector = await createDetector(STATE.model);
        }
        catch (error) {
            detector = null;
            alert(error);
        }

        STATE.isFlagChanged = false;
        STATE.isBackendChanged = false;
        STATE.isModelChanged = false;
    }
};

const endEstimateHandsStats = () => {
    const endInferenceTime = (performance || Date).now();

    const panelUpdateMilliseconds = 1000;

    if (endInferenceTime - lastPanelUpdate >= panelUpdateMilliseconds) {
        lastPanelUpdate = endInferenceTime;
    }
};

const renderResult = async () => {
    if (camera.video.readyState < 2) {
        await new Promise((resolve) => {
            camera.video.onloadeddata = () => {
                resolve(video);
            };
        });
    }

    let hands = null;

    if (detector != null) {
        try {
            hands = await detector.estimateHands(camera.video, { flipHorizontal: false });
        }
        catch (error) {
            detector.dispose();
            detector = null;
            alert(error);
        }

        endEstimateHandsStats();
    }

    camera.drawCtx();

    if (hands && hands.length > 0 && !STATE.isModelChanged) {
        camera.drawResults(hands);
    }
};

const renderPrediction = async () => {
    await checkGuiUpdate();

    if (!STATE.isModelChanged) {
        await renderResult();
    }

    rafId = requestAnimationFrame(renderPrediction);
};

const initializeModel = async () => {
    const urlParams = new URLSearchParams(window.location.search);

    if (!urlParams.has('model')) {
        alert('Cannot find model in the query string.');
        return;
    }

    await setupDatGui(urlParams);

    camera = await Camera.setupCamera(STATE.camera);

    await setBackendAndEnvFlags(STATE.flags, STATE.backend);

    detector = await createDetector();

    renderPrediction();
};

export { initializeModel };
