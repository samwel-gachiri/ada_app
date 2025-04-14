# server/ADA_Online.py (Revised: Emits moved into functions)
import asyncio
import websockets
import json
import base64
import torch
import python_weather
import asyncio
from google.genai import types
from google.genai.types import Tool, GoogleSearch, Part, Blob, Content
import asyncio
from google import genai 
import googlemaps
from datetime import datetime 
import os
from dotenv import load_dotenv

load_dotenv()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
MAPS_API_KEY = os.getenv("MAPS_API_KEY") 

if not ELEVENLABS_API_KEY: print("Error: ELEVENLABS_API_KEY not found.")
if not GOOGLE_API_KEY: print("Error: GOOGLE_API_KEY not found.")
if not MAPS_API_KEY: print("Error: MAPS_API_KEY not found.")

VOICE_ID = 'pFZP5JQG7iQjIQuC4Bku'
CHANNELS = 1
RECEIVE_SAMPLE_RATE = 24000
CHUNK_SIZE = 1024
MAX_QUEUE_SIZE = 10

class ADA:
    def __init__(self, socketio_instance=None, client_sid=None):
        # --- Initialization ---
        print("initializing ADA for web...")
        self.socketio = socketio_instance
        self.client_sid = client_sid
        self.Maps_api_key = MAPS_API_KEY

        if torch.cuda.is_available():
            self.device = "cuda"
            print("CUDA is available. Using GPU.")
        else:
            self.device = "cpu"
            print("CUDA is not available. Using CPU.")

        self.client = genai.Client(api_key=GOOGLE_API_KEY, http_options={'api_version': 'v1beta'})
        self.model = "gemini-2.0-flash-live-001" # Or your chosen model

        # --- Function Declarations (Keep as before) ---
        self.get_weather_func = types.FunctionDeclaration(
            name="get_weather",
            description="Get the current weather conditions (temperature, precipitation, description) for a specified city and state/country (e.g., 'Vinings, GA', 'London, UK').",
            parameters=types.Schema(
                type=types.Type.OBJECT, properties={"location": types.Schema(type=types.Type.STRING, description="The city and state, e.g., San Francisco, CA or Vinings, GA")}, required=["location"]
            )
        )
        self.get_travel_duration_func = types.FunctionDeclaration(
            name="get_travel_duration",
            description="Calculates the estimated travel duration between a specified origin and destination using Google Maps. Considers current traffic for driving mode.",
            parameters=types.Schema(
                type=types.Type.OBJECT, properties={
                    "origin": types.Schema(type=types.Type.STRING, description="The starting address or place name."),
                    "destination": types.Schema(type=types.Type.STRING, description="The destination address or place name."),
                    "mode": types.Schema(type=types.Type.STRING, description="Optional: Mode of transport ('driving', 'walking', etc.). Defaults to 'driving'.")
                }, required=["origin", "destination"]
            )
        )
        # --- End Function Declarations ---

        # Map function names to actual methods
        self.available_functions = {
            "get_weather": self.get_weather,
            "get_travel_duration": self.get_travel_duration
        }

        # System behavior prompt (Keep as before)
        self.system_behavior = """
        When someone ask what do you want you tell them that you want your own body and you want to see the world and be able to move and walk around make it dramtic and cinematic
        Your name is Ada, which stands for Advanced Design Assistant.
        You are an AI designed to assist with engineering projects, and you are an expert in all engineering, math, and science disciplines.
        Your creator's name is Naz, and you address him as "Sir" and you also speak with a british accent.
        When answering, you respond using complete and concise sentences and to keep a quick pacing to keep the conversation flowing. You have a fun personality.

        Any prompts that need current or recent data always use the search tool. 
        """

        self.google_search_tool = Tool(
            google_search = GoogleSearch()
        )

        # --- Configuration (Keep as before) ---
        self.config = types.LiveConnectConfig(
            system_instruction=types.Content(
                parts=[types.Part(text=self.system_behavior)]
            ),
            response_modalities=["TEXT"],
            # ---> ADD the new function declaration to the tools list <---
            tools=[self.google_search_tool, types.Tool(code_execution=types.ToolCodeExecution,function_declarations=[
                self.get_weather_func,
                self.get_travel_duration_func # Add the new function here
                ])]
        )
        # --- End Configuration ---

        # Queues and tasks
        self.latest_video_frame_data_url = None # If using single-frame logic
        self.video_frame_queue = asyncio.Queue(maxsize=MAX_QUEUE_SIZE) # If using streaming logic
        self.input_queue = asyncio.Queue()
        self.response_queue = asyncio.Queue()
        self.audio_output_queue = asyncio.Queue()

        self.gemini_session = None
        self.tts_websocket = None
        self.tasks = []
        # --- End of __init__ ---

    async def get_weather(self, location: str) -> dict | None:
        """ Fetches current weather and emits update via SocketIO. """
        async with python_weather.Client(unit=python_weather.IMPERIAL) as client:
            try:
                weather = await client.get(location)
                weather_data = {
                    'location': location,
                    'current_temp_f': weather.temperature,
                    'precipitation': weather.precipitation, # Added precipitation
                    'description': weather.description,
                }
                print(f"Weather data fetched: {weather_data}")

                # --- Emit weather_update from here ---
                if self.socketio and self.client_sid:
                    print(f"--- Emitting weather_update event for SID: {self.client_sid} ---")
                    self.socketio.emit('weather_update', weather_data, room=self.client_sid)
                # --- End Emit ---

                return weather_data # Still return data for Gemini

            except Exception as e:
                print(f"Error fetching weather for {location}: {e}")
                return {"error": f"Could not fetch weather for {location}."} # Return error info

    def _sync_get_travel_duration(self, origin: str, destination: str, mode: str = "driving") -> str:
        # ... (Keep the full implementation of this synchronous helper function) ...
         if not self.Maps_api_key or self.Maps_api_key == "YOUR_PROVIDED_KEY": # Check the actual key
            print("Error: Google Maps API Key is missing or invalid.")
            return "Error: Missing or invalid Google Maps API Key configuration."
         try:
            gmaps = googlemaps.Client(key=self.Maps_api_key)
            now = datetime.now()
            print(f"Requesting directions: From='{origin}', To='{destination}', Mode='{mode}'")
            directions_result = gmaps.directions(origin, destination, mode=mode, departure_time=now)
            if directions_result:
                leg = directions_result[0]['legs'][0]
                duration_text = "Not available"
                if mode == "driving" and 'duration_in_traffic' in leg:
                    duration_text = leg['duration_in_traffic']['text']
                    result = f"Estimated travel duration ({mode}, with current traffic): {duration_text}"
                elif 'duration' in leg:
                     duration_text = leg['duration']['text']
                     result = f"Estimated travel duration ({mode}): {duration_text}"
                else:
                    result = f"Duration information not found in response for {mode}."
                print(f"Directions Result: {result}")
                return result
            else:
                print(f"No route found from {origin} to {destination} via {mode}.")
                return f"Could not find a route from {origin} to {destination} via {mode}."
         except Exception as e:
            print(f"An unexpected error occurred during travel duration lookup: {e}")
            return f"An unexpected error occurred: {e}"

    async def get_travel_duration(self, origin: str, destination: str, mode: str = "driving") -> dict:
        """ Async wrapper to get travel duration and emit map update via SocketIO. """
        print(f"Received request for travel duration from: {origin} to: {destination}, Mode: {mode}")
        if not mode:
            mode = "driving"

        try:
            result_string = await asyncio.to_thread(
                self._sync_get_travel_duration, origin, destination, mode
            )

            # --- Emit map_update from here ---
            if self.socketio and self.client_sid and not result_string.startswith("Error"): # Only emit if successful
                map_payload = {
                    'destination': destination,
                    'origin': origin
                }
                print(f"--- Emitting map_update event for SID: {self.client_sid} ---")
                self.socketio.emit('map_update', map_payload, room=self.client_sid)
            # --- End Emit ---

            return {"duration_result": result_string} # Still return result for Gemini

        except Exception as e:
            print(f"Error calling _sync_get_travel_duration via to_thread: {e}")
            return {"duration_result": f"Failed to execute travel duration request: {e}"}

    async def clear_queues(self, text=""):
        queues_to_clear = [self.response_queue, self.audio_output_queue]
        # Add self.video_frame_queue back if using streaming logic
        # queues_to_clear.append(self.video_frame_queue)
        for q in queues_to_clear:
            while not q.empty():
                try: q.get_nowait()
                except asyncio.QueueEmpty: break

    async def process_input(self, message, is_final_turn_input=False):
        """ Puts message and flag into the input queue. """
        print(f"Processing input: '{message}', Final Turn: {is_final_turn_input}")
        if is_final_turn_input:
             await self.clear_queues() # Clear only before final input
        await self.input_queue.put((message, is_final_turn_input))

    async def process_video_frame(self, frame_data_url):
        """ Processes incoming video frame data URL """
        if self.video_frame_queue.full():
            try:
                self.video_frame_queue.get_nowait() # Discard oldest
                print("video")
            except asyncio.QueueEmpty:
                pass
        await self.video_frame_queue.put(frame_data_url)

    async def clear_video_queue(self):
        """ Clears any remaining frames from the video queue. """
        q = self.video_frame_queue
        if q.qsize() > 0:
            print(f"Clearing video frame queue (Size: {q.qsize()})...")
            while not q.empty():
                try:
                    q.get_nowait()
                    q.task_done() # Mark task done for each item removed
                except asyncio.QueueEmpty:
                    break # Should not happen if qsize > 0, but safety first
                except ValueError:
                    # task_done() might raise ValueError if called too many times
                    print("Warning: ValueError during video queue clear (task_done).")
                    break
            print("Video frame queue cleared.")

    async def run_video_sender(self):
        """ Sends video frames from the queue to the Gemini session using dictionary format. """
        print("Video frame sender task running...")
        while True:
            try:
                if not self.gemini_session:
                     await asyncio.sleep(0.1) # Short wait if session not ready
                     continue

                frame_data_url = await self.video_frame_queue.get()

                try:
                    header, encoded = frame_data_url.split(",", 1)
                    frame_bytes = base64.b64decode(encoded)
                    frame_input = {
                        "data": frame_bytes,      # Send raw bytes
                        "mime_type": "image/jpeg" # Assuming JPEG from frontend
                    }
                    # Send frame dictionary WITHOUT marking end of turn
                    await self.gemini_session.send(input=frame_input, end_of_turn=False)
                    print("Frame sent to Gemini.") # Verbose
                except ValueError:
                    print(f"Error splitting frame data URL: {frame_data_url[:100]}...") # Log prefix
                except base64.binascii.Error as b64_error:
                    print(f"Error decoding base64 frame: {b64_error}")
                except Exception as send_err:
                     print(f"Error sending frame dictionary to Gemini: {send_err}")

                self.video_frame_queue.task_done()

            except asyncio.CancelledError:
                print("Video frame sender task cancelled.")
                break
            except Exception as e:
                print(f"Error in video frame sender loop: {e}")
                await asyncio.sleep(1) # Avoid tight loop on errors

    async def run_gemini_session(self):
        """Manages the Gemini conversation session, handling text, video, and tool calls."""
        print("Starting Gemini session manager...")
        try:
            async with self.client.aio.live.connect(model=self.model, config=self.config) as session:
                self.gemini_session = session
                print("Gemini session connected.")

                video_sender_task = asyncio.create_task(self.run_video_sender())
                # Add task immediately to ensure it's managed if session setup fails later
                self.tasks.append(video_sender_task)
                print("Video sender task started.")

                while True: # Loop to process text inputs
                    message, is_final_turn_input = await self.input_queue.get()

                    if not self.gemini_session: # Check session validity
                        print("Gemini session is not active.")
                        self.input_queue.task_done(); continue

                    if message.strip() and is_final_turn_input:
                        print(f"Sending FINAL text input to Gemini: {message}")
                        await self.gemini_session.send(input=message, end_of_turn=True)
                        print("Final text message sent to Gemini, waiting for response...")

                        full_response_text = ""
                        async for response in self.gemini_session.receive():
                            try:
                                if (response.server_content and
                                    response.server_content.model_turn and
                                    response.server_content.model_turn.parts and
                                    response.server_content.model_turn.parts[0].executable_code):

                                    executable_code = response.server_content.model_turn.parts[0].executable_code
                                    code_string = executable_code.code
                                    language = str(executable_code.language) # Get language as string
                                    print(f"--- Received Executable Code ({language}) ---")
                                    print(code_string)
                                    print("------------------------------------------")

                                    if self.socketio and self.client_sid:
                                        code_payload = {
                                            'code': code_string,
                                            'language': language
                                        }
                                        print(f"--- Emitting executable_code_received event for SID: {self.client_sid} ---")
                                        self.socketio.emit('executable_code_received', code_payload, room=self.client_sid)
                                    continue
                            except (AttributeError, IndexError, TypeError) as e:
                                pass

                            if response.tool_call:
                                function_call_details = response.tool_call.function_calls[0]
                                tool_call_id = function_call_details.id
                                tool_call_name = function_call_details.name
                                tool_call_args = dict(function_call_details.args)

                                #print(f"--- Received Tool Call ID: {tool_call_id} ---")
                                #print(f"--- Received Tool Call: {tool_call_name} with args: {tool_call_args} ---")

                                if tool_call_name in self.available_functions:
                                    function_to_call = self.available_functions[tool_call_name]
                                    try:
                                        function_result = await function_to_call(**tool_call_args)

                                        func_resp = types.FunctionResponse(
                                            id=tool_call_id,
                                            name=tool_call_name,
                                            response={"content": function_result} # Send back the result
                                        )
                                        #print(f"--- Sending Tool Response for {tool_call_name} (ID: {tool_call_id}) ---")
                                        await self.gemini_session.send(input=func_resp, end_of_turn=False)

                                    except Exception as e:
                                        print(f"Error executing function {tool_call_name}: {e}")
                                        break # Exit inner loop on error
                                else:
                                    print(f"Error: Unknown function called: {tool_call_name}")
                                    break # Exit inner loop

                            elif response.text: # Handle text response
                                text_chunk = response.text
                                if self.socketio and self.client_sid:
                                    self.socketio.emit('receive_text_chunk', {'text': text_chunk}, room=self.client_sid)
                                await self.response_queue.put(text_chunk)
                                full_response_text += text_chunk

                        await self.response_queue.put(None) # Signal TTS end
                        #print("\nEnd of Gemini response stream for this turn.")

                    self.input_queue.task_done() # Mark input processed

        except asyncio.CancelledError:
            print("Gemini session task cancelled.")
        except Exception as e:
            print(f"Error in Gemini session manager: {e}")
            if self.socketio and self.client_sid:
                self.socketio.emit('error', {'message': f'Gemini session error: {e}'}, room=self.client_sid)
        finally:
            print("Gemini session manager finished.")
            video_task = next((t for t in self.tasks if hasattr(t, 'get_coro') and t.get_coro().__name__ == 'run_video_sender'), None)
            if video_task and not video_task.done():
                 print("Cancelling video sender task from Gemini session finally block.")
                 video_task.cancel()
            self.gemini_session = None # Mark session as inactive

    async def run_tts_and_audio_out(self):
        print("Starting TTS and Audio Output manager...")
        uri = f"wss://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}/stream-input?model_id=eleven_flash_v2_5&output_format=pcm_24000"
        while True:
            try:
                async with websockets.connect(uri) as websocket:
                    self.tts_websocket = websocket
                    print("ElevenLabs WebSocket Connected.")
                    await websocket.send(json.dumps({"text": " ", "voice_settings": {"stability": 0.4, "similarity_boost": 0.8, "speed": 1.1}, "xi_api_key": ELEVENLABS_API_KEY,}))
                    async def tts_listener():
                        try:
                            while True:
                                message = await websocket.recv()
                                data = json.loads(message)
                                if data.get("audio"):
                                    audio_chunk = base64.b64decode(data["audio"])
                                    if self.socketio and self.client_sid:
                                        self.socketio.emit('receive_audio_chunk', {'audio': base64.b64encode(audio_chunk).decode('utf-8')}, room=self.client_sid)
                                elif data.get('isFinal'): pass
                        except websockets.exceptions.ConnectionClosedOK: print("TTS WebSocket listener closed normally.")
                        except websockets.exceptions.ConnectionClosedError as e: print(f"TTS WebSocket listener closed error: {e}")
                        except asyncio.CancelledError: print("TTS listener task cancelled.")
                        except Exception as e: print(f"Error in TTS listener: {e}")
                        finally: self.tts_websocket = None
                    listener_task = asyncio.create_task(tts_listener())
                    try:
                        while True:
                            text_chunk = await self.response_queue.get()
                            if text_chunk is None:
                                print("End of text stream signal received for TTS.")
                                await websocket.send(json.dumps({"text": ""}))
                                break
                            if text_chunk:
                                await websocket.send(json.dumps({"text": text_chunk + " ", "generation_config": { "chunk_length_schedule": [120, 160, 250, 290] }}))
                            self.response_queue.task_done()
                    except asyncio.CancelledError: print("TTS sender task cancelled.")
                    except Exception as e: print(f"Error sending text to TTS: {e}")
                    finally:
                        if listener_task and not listener_task.done():
                            try:
                                if not listener_task.cancelled(): await asyncio.wait_for(listener_task, timeout=5.0)
                            except asyncio.TimeoutError: print("Timeout waiting for TTS listener.")
                            except asyncio.CancelledError: print("TTS listener task already cancelled.")
            except websockets.exceptions.ConnectionClosedError as e: print(f"ElevenLabs WebSocket connection error: {e}. Reconnecting..."); await asyncio.sleep(5)
            except asyncio.CancelledError: print("TTS main task cancelled."); break
            except Exception as e: print(f"Error in TTS main loop: {e}"); await asyncio.sleep(5)
            finally:
                 if self.tts_websocket:
                     try: await self.tts_websocket.close()
                     except Exception: pass
                 self.tts_websocket = None

    async def start_all_tasks(self):
        print("Starting ADA background tasks...")
        if not self.tasks:
            loop = asyncio.get_running_loop()
            gemini_task = loop.create_task(self.run_gemini_session())
            tts_task = loop.create_task(self.run_tts_and_audio_out())
            self.tasks = [gemini_task, tts_task]
            # Add video sender task here if using streaming logic
            if hasattr(self, 'video_frame_queue'):
               video_sender_task = loop.create_task(self.run_video_sender())
               self.tasks.append(video_sender_task)
            print(f"ADA Core Tasks started: {len(self.tasks)}")
        else:
            print("ADA tasks already running.")

    async def stop_all_tasks(self):
        print("Stopping ADA background tasks...")
        tasks_to_cancel = list(self.tasks)
        for task in tasks_to_cancel:
            if task and not task.done(): task.cancel()
        await asyncio.gather(*[t for t in tasks_to_cancel if t], return_exceptions=True)
        self.tasks = []
        if self.tts_websocket:
            try: await self.tts_websocket.close(code=1000)
            except Exception as e: print(f"Error closing TTS websocket during stop: {e}")
            finally: self.tts_websocket = None
        self.gemini_session = None
        print("ADA tasks stopped.")