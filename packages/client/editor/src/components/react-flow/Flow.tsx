import React from 'react';
import { Background, BackgroundVariant, ReactFlow, MiniMap } from 'reactflow';

import CustomControls from './Controls.js'
import { NodePicker } from './NodePicker.js'
import { useBehaveGraphFlow } from '../../hooks/react-flow/useBehaveGraphFlow.js'
import { useFlowHandlers } from '../../hooks/react-flow/useFlowHandlers.js'
import { Tab, usePubSub } from '@magickml/providers'

import './flowOverrides.css'
import { SpellInterface } from 'server/schemas'
import { getNodeSpec } from 'shared/nodeSpec'
import { useSelector } from 'react-redux'
import { RootState } from 'client/state'
import { nodeColor } from '../../utils/nodeColor.js'
import { ContextNodeMenu } from './ContextNodeMenu'
import CustomEdge from './CustomEdge.js';

type FlowProps = {
  spell: SpellInterface;
  parentRef: React.RefObject<HTMLDivElement>;
  tab: Tab
}

const edgeTypes = {
  'custom-edge': CustomEdge,
};

const proOptions = {
  // passing in the account property will enable hiding the attribution
  // for versions < 10.2 you can use account: 'paid-enterprise'
  account: 'paid-pro',
  // in combination with the account property, hideAttribution: true will remove the attribution
  hideAttribution: true,
};

export const Flow: React.FC<FlowProps> = ({ spell, parentRef, tab }) => {
  const specJson = getNodeSpec()
  const globalConfig = useSelector((state: RootState) => state.globalConfig)
  const { projectId, currentAgentId } = globalConfig
  const { publish, events } = usePubSub()

  const [playing, setPlaying] = React.useState(false)
  const [miniMapOpen, setMiniMapOpen] = React.useState(true)

  const { SEND_COMMAND } = events

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setGraphJson,
    nodeTypes,
    onConnect,
  } = useBehaveGraphFlow({
    spell,
    specJson,
    tab,
  })

  const {
    handleStartConnect,
    handleStopConnect,
    handlePaneClick,
    handlePaneContextMenu,
    nodePickerVisibility,
    handleAddNode,
    closeNodePicker,
    nodePickFilters,
    nodeMenuVisibility,
    handleNodeContextMenu,
    openNodeMenu,
    setOpenNodeMenu,
    nodeMenuActions
  } = useFlowHandlers({
    nodes,
    onEdgesChange,
    onNodesChange,
    specJSON: specJson,
    parentRef,
    tab,
  })

  const togglePlay = () => {
    if (playing) {
      publish(SEND_COMMAND, {
        projectId,
        agentId: currentAgentId,
        command: 'agent:core:pauseSpell',
        data: {
          spellId: spell.id,
        },
      })
    } else {
      publish(SEND_COMMAND, {
        projectId,
        agentId: currentAgentId,
        command: 'agent:core:playSpell',
        data: {
          spellId: spell.id,
        },
      })
    }
    setPlaying(!playing)
  }

  return (
    <ReactFlow
      proOptions={proOptions}
      nodeTypes={nodeTypes}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange(tab.id)}
      onEdgesChange={onEdgesChange(tab.id)}
      onConnect={onConnect(tab.id)}
      edgeTypes={edgeTypes}
      onConnectStart={handleStartConnect}
      onConnectEnd={handleStopConnect}
      fitView
      fitViewOptions={{ maxZoom: 2, minZoom: 0.1 }}
      minZoom={0.1}
      onPaneClick={handlePaneClick}
      onPaneContextMenu={handlePaneContextMenu}
      onNodeContextMenu={handleNodeContextMenu}
    >
      <CustomControls
        playing={playing}
        togglePlay={togglePlay}
        setBehaviorGraph={setGraphJson}
        specJson={specJson}
        miniMapOpen={miniMapOpen}
        toggleMiniMap={() => setMiniMapOpen(!miniMapOpen)}
      />
      <Background
        variant={BackgroundVariant.Lines}
        color="var(--background-color-light)"
        style={{ backgroundColor: 'var(--background-color)' }}
      />
      {miniMapOpen && (
        <MiniMap
          nodeStrokeWidth={3}
          maskColor="#69696930"
          nodeColor={node => nodeColor(node, specJson, spell)}
          pannable
          zoomable
        />
      )}
      {nodePickerVisibility && (
        <NodePicker
          position={nodePickerVisibility}
          filters={nodePickFilters}
          onPickNode={handleAddNode}
          onClose={closeNodePicker}
          specJSON={specJson}
        />
      )}

      {openNodeMenu && (
        <ContextNodeMenu
          position={nodeMenuVisibility}
          isOpen={openNodeMenu}
          onClose={() => setOpenNodeMenu(false)}
          actions={nodeMenuActions}
        />
      )}
    </ReactFlow>
  )
}
