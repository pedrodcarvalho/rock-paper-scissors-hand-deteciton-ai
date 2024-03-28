import * as handDetection from '@tensorflow-models/hand-pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import dat from 'dat.gui';

import * as params from './utils/params';

let TUNABLE_FLAG_DEFAULT_VALUE_MAP;

const stringValueMap = {};

export const setupDatGui = async (urlParams) => {
    const gui = new dat.GUI({ width: 300 });
    gui.domElement.id = 'gui';

    const cameraFolder = gui.addFolder('Camera');
    const fpsController = cameraFolder.add(params.STATE.camera, 'targetFPS');

    fpsController.onFinishChange(() => {
        params.STATE.isTargetFPSChanged = true;
    });

    const sizeController = cameraFolder.add(params.STATE.camera, 'sizeOption', Object.keys(params.VIDEO_SIZE));

    sizeController.onChange(() => {
        params.STATE.isSizeOptionChanged = true;
    });

    cameraFolder.open();

    const modelFolder = gui.addFolder('Model');

    const model = urlParams.get('model');
    let type = urlParams.get('type');
    let maxNumHands = urlParams.get('maxNumHands');

    switch (model) {
        case 'mediapipe_hands':
            params.STATE.model = handDetection.SupportedModels.MediaPipeHands;

            if (type !== 'full' && type !== 'lite') {
                type = null;
            }

            if (maxNumHands == null || maxNumHands < 1) {
                maxNumHands = 2;
            }

            break;
        default:
            alert(`${urlParams.get('model')}`);
    }

    const modelController = modelFolder.add(params.STATE, 'model', Object.values(handDetection.SupportedModels));

    modelController.onChange(() => {
        params.STATE.isModelChanged = true;
        showModelConfigs(modelFolder);
        showBackendConfigs(backendFolder);
    });

    showModelConfigs(modelFolder, type, maxNumHands);

    modelFolder.open();

    const backendFolder = gui.addFolder('Backend');

    showBackendConfigs(backendFolder);

    backendFolder.open();

    return gui;
};

const showBackendConfigs = async (folderController) => {
    const fixedSelectionCount = 0;

    while (folderController.__controllers.length > fixedSelectionCount) {
        folderController.remove(folderController.__controllers[folderController.__controllers.length - 1]);
    }

    const backends = params.MODEL_BACKEND_MAP[params.STATE.model];

    params.STATE.backend = backends[0];

    const backendController = folderController.add(params.STATE, 'backend', backends);
    backendController.name('runtime-backend');

    backendController.onChange(async backend => {
        params.STATE.isBackendChanged = true;
        await showFlagSettings(folderController, backend);
    });

    await showFlagSettings(folderController, params.STATE.backend);
};

const showModelConfigs = (folderController, type, maxNumHands) => {
    const fixedSelectionCount = 1;

    while (folderController.__controllers.length > fixedSelectionCount) {
        folderController.remove(folderController.__controllers[folderController.__controllers.length - 1]);
    }

    switch (params.STATE.model) {
        case handDetection.SupportedModels.MediaPipeHands:
            addMediaPipeHandsControllers(folderController, type, maxNumHands);
            break;
        default:
            alert(`Model ${params.STATE.model} is not supported.`);
    }
};

const addMediaPipeHandsControllers = (modelConfigFolder, type, maxNumHands) => {
    params.STATE.modelConfig = { ...params.MEDIAPIPE_HANDS_CONFIG };
    params.STATE.modelConfig.type = type != null ? type : 'full';
    params.STATE.modelConfig.maxNumHands = maxNumHands != null ? maxNumHands : 2;

    const typeController = modelConfigFolder.add(params.STATE.modelConfig, 'type', ['lite', 'full']);

    typeController.onChange(() => {
        params.STATE.isModelChanged = true;
    });

    const maxNumHandsController = modelConfigFolder.add(params.STATE.modelConfig, 'maxNumHands', 1, 10).step(1);

    maxNumHandsController.onChange(() => {
        params.STATE.isModelChanged = true;
    });

    const render3DController = modelConfigFolder.add(params.STATE.modelConfig, 'render3D');

    render3DController.onChange(render3D => {
        document.querySelector('#scatter-gl-container-left').style.display = render3D ? 'inline-block' : 'none';
        document.querySelector('#scatter-gl-container-right').style.display = render3D ? 'inline-block' : 'none';
    });
};

const initDefaultValueMap = async () => {
    TUNABLE_FLAG_DEFAULT_VALUE_MAP = {};
    params.STATE.flags = {};

    for (const backend in params.BACKEND_FLAGS_MAP) {
        for (let index = 0; index < params.BACKEND_FLAGS_MAP[backend].length; index++) {
            const flag = params.BACKEND_FLAGS_MAP[backend][index];
            TUNABLE_FLAG_DEFAULT_VALUE_MAP[flag] = await tf.env().getAsync(flag);
        }
    }

    for (const flag in TUNABLE_FLAG_DEFAULT_VALUE_MAP) {
        if (params.BACKEND_FLAGS_MAP[params.STATE.backend].indexOf(flag) > -1) {
            params.STATE.flags[flag] = TUNABLE_FLAG_DEFAULT_VALUE_MAP[flag];
        }
    }
};

const getTunableRange = (flag) => {
    const defaultValue = TUNABLE_FLAG_DEFAULT_VALUE_MAP[flag];

    if (flag === 'WEBGL_FORCE_F16_TEXTURES') {
        return [false, true];
    }
    else if (flag === 'WEBGL_VERSION') {
        const tunableRange = [];

        for (let value = 1; value <= defaultValue; value++) {
            tunableRange.push(value);
        }

        return tunableRange;
    }
    else if (flag === 'WEBGL_FLUSH_THRESHOLD') {
        const tunableRange = [-1];

        for (let value = 0; value <= 2; value += 0.25) {
            tunableRange.push(value);
        }

        return tunableRange;
    }
    else if (typeof defaultValue === 'boolean') {
        return defaultValue ? [false, true] : [false];
    }
    else if (params.TUNABLE_FLAG_VALUE_RANGE_MAP[flag] != null) {
        return params.TUNABLE_FLAG_VALUE_RANGE_MAP[flag];
    }
    else {
        return [defaultValue];
    }
};

const showBackendFlagSettings = (folderController, backendName) => {
    const tunableFlags = params.BACKEND_FLAGS_MAP[backendName];

    for (let index = 0; index < tunableFlags.length; index++) {
        const flag = tunableFlags[index];
        const flagName = params.TUNABLE_FLAG_NAME_MAP[flag] || flag;

        const flagValueRange = getTunableRange(flag);

        if (flagValueRange.length < 2) {
            console.warn(`The ${flag} is considered as untunable, because its value range is [${flagValueRange}].`);
            continue;
        }

        let flagController;

        if (typeof flagValueRange[0] === 'boolean') {
            flagController = folderController.add(params.STATE.flags, flag);
        }
        else {
            flagController = folderController.add(params.STATE.flags, flag, flagValueRange);

            if (stringValueMap[flag] == null) {
                stringValueMap[flag] = {};

                for (let index = 0; index < flagValueRange.length; index++) {
                    const realValue = flagValueRange[index];
                    const stringValue = String(flagValueRange[index]);
                    stringValueMap[flag][stringValue] = realValue;
                }
            }

            flagController.onFinishChange(stringValue => {
                params.STATE.flags[flag] = stringValueMap[flag][stringValue];
            });
        }

        flagController.name(flagName).onChange(() => {
            params.STATE.isFlagChanged = true;
        });
    }
}

const showFlagSettings = async (folderController, backendName) => {
    await initDefaultValueMap();

    const fixedSelectionCount = 1;

    while (folderController.__controllers.length > fixedSelectionCount) {
        folderController.remove(folderController.__controllers[folderController.__controllers.length - 1]);
    }

    showBackendFlagSettings(folderController, backendName);
};
