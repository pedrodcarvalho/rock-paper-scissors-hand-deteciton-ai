import React, { useEffect } from 'react';

import { initializeModel } from './model/main';

const App = () => {
  useEffect(() => {
    initializeModel();
  }, []);

  return (
    <>
      <div className='canvas-wrapper'>
        <canvas id='output'></canvas>
        <video id='video' playsInline style={{ WebkitTransform: 'scaleX(-1)', transform: 'scaleX(-1)', visibility: 'hidden', width: 'auto', height: 'auto' }}></video>
      </div>
      <div id='scatter-gl-container-left'></div>
      <div id='scatter-gl-container-right'></div>
    </>
  );
};

export default App;
