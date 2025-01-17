import { VariableJSON } from '@magickml/behave-graph'
import { Tab, useConfig } from '@magickml/providers'
import { Window } from 'client/core'
import {
  selectGraphJson,
  selectTabEdges,
  selectTabNodes,
  setEdges,
  setNodes,
  useGetSpellByNameQuery,
  useSaveSpellMutation,
} from 'client/state'
import { v4 as uuidv4 } from 'uuid'
import { IDockviewPanelProps } from 'dockview'
import { useCallback, useState } from 'react'
import { enqueueSnackbar } from 'notistack'
import { Variable } from './Variable'
import { useSelector } from 'react-redux'
import { Button, Input } from '@magickml/client-ui'

type Props = IDockviewPanelProps<{
  tab: Tab
  spellId: string
  spellName: string
}>

export const VariableWindow = (props: Props) => {
  const { tab, spellName } = props.params

  const { spell } = useGetSpellByNameQuery(
    { spellName },
    {
      skip: !spellName,
      selectFromResult: data => ({
        spell: data?.data?.data[0],
      }),
    }
  )

  const nodes = useSelector(selectTabNodes(tab.id))
  const edges = useSelector(selectTabEdges(tab.id))

  const [newVariableName, setNewVariableName] = useState<string>('')
  const graphJson = useSelector(selectGraphJson(tab.id))
  const { projectId } = useConfig()
  const [saveSpellMutation] = useSaveSpellMutation()

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewVariableName(e.target.value)
  }

  const deleteAllVariableNodes = useCallback(
    (variable: VariableJSON) => {
      const newNodes = nodes.filter(node => !node.type?.includes(variable.name))

      const removedNodes = nodes
        .filter(node => node.type?.includes(variable.name))
        .map(node => node.id)

      const newEdges = edges.filter(
        edge =>
          !removedNodes.includes(edge.source) &&
          !removedNodes.includes(edge.target)
      )

      setNodes(tab.id, newNodes)
      setEdges(tab.id, newEdges)
    },
    [nodes, edges]
  )

  const saveVariable = useCallback(
    (variable: VariableJSON) => {
      const graph = spell.graph
      const variables = graph.variables.map(v =>
        v.id === variable.id ? variable : v
      )

      const newGraph = { ...graph, variables }
      const newSpell = { ...spell, graph: newGraph }

      return saveSpellMutation({ projectId, spell: newSpell })
        .then(() => enqueueSnackbar('Variable saved', { variant: 'success' }))
        .catch(err => {
          console.error(err)
          enqueueSnackbar('Error saving variable', { variant: 'error' })
        })
    },
    [spell, projectId, enqueueSnackbar, graphJson]
  ) // dependencies

  const deleteVariable = useCallback(
    (variableId: string) => {
      const graph = spell.graph
      const variable = graph.variables.find(v => v.id === variableId)
      const newGraph = {
        ...graph,
        variables: graph.variables.filter(v => v.id !== variableId),
      }
      const updatedGraph = {
        ...newGraph,
        nodes: graph.nodes.filter(node => !node.type.includes(variable.name)),
      }

      const newSpell = { ...spell, graph: updatedGraph }

      deleteAllVariableNodes(variable)

      return saveSpellMutation({ projectId, spell: newSpell })
        .then(() => enqueueSnackbar('Variable deleted', { variant: 'success' }))
        .catch(err => {
          console.error(err)
          enqueueSnackbar('Error deleting variable', { variant: 'error' })
        })
    },
    [spell, projectId, enqueueSnackbar, graphJson]
  ) // dependencies

  const createNewVariable = useCallback(() => {
    const newVariable: VariableJSON = {
      name: newVariableName,
      id: uuidv4(),
      valueTypeName: 'string',
      initialValue: [],
    }

    const graph = spell.graph
    const newGraph = { ...graph, variables: [...graph.variables, newVariable] }
    const newSpell = { ...spell, graph: newGraph }

    return saveSpellMutation({ projectId, spell: newSpell })
      .then(() => {
        enqueueSnackbar('Variable created', { variant: 'success' })
        setNewVariableName('') // Assuming this state is managed in this component
      })
      .catch(err => {
        console.error(err)
        enqueueSnackbar('Error creating variable', { variant: 'error' })
      })
  }, [spell, projectId, enqueueSnackbar, newVariableName, graphJson]) // dependencies

  if (!spell?.graph) return null

  return (
    <Window borderless>
      <div className="flex flex-row items-center px-2 mt-2 gap-2 border-b-2 border-b-solid border-b-[var(--background-color)] pb-2 justify-center h-10">
        <Input
          className={`focus:ring-2 focus:ring-[var(--accent-color)] focus:border-transparent h-full`}
          onChange={onInputChange}
          value={newVariableName}
          placeholder="New variable"
        />
        <Button
          className="h-full w-8 border border-[var(--dark-3)] bg-ds-neutral rounded-sm"
          variant="secondary"
          onClick={createNewVariable}
        >
          +
        </Button>
      </div>
      <div>
        {spell.graph.variables.map(variable => {
          return (
            <Variable
              variable={variable}
              updateVariable={saveVariable}
              deleteVariable={deleteVariable}
            />
          )
        })}
      </div>
    </Window>
  )
}
